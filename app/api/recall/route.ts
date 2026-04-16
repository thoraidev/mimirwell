/**
 * POST /api/recall
 * Fetches an encrypted memory blob from Arweave (or legacy Filecoin) and returns it.
 *
 * MimirWell is zero-knowledge — this server never decrypts.
 * Revocation is enforced before returning the blob: a revoked agent
 * never receives the ciphertext, so it cannot decrypt even with its own key.
 *
 * Body: { txId: string, ownerWallet?: string, agentWallet?: string }
 *   For backward compatibility, "cid" is also accepted as an alias for txId.
 *
 * Returns:
 *   { encryptedBlob, agentWallet, ownerWallet, version, status: "stored" }
 *   OR { status: "denied", reason: "..." }  (403)
 *
 * ─── Backend detection ────────────────────────────────────────────────────────
 * txId is an Arweave transaction ID (43-char base64url).
 * Legacy CIDs (Filecoin/IPFS, starting with "bafy…" or "Qm…") are served from
 * IPFS gateways for backward compatibility with zk-v1 blobs stored before migration.
 *
 * ─── Version handling ─────────────────────────────────────────────────────────
 * zk-v2: agent should use decryptAndDecompressMemory() or autoDecryptMemory()
 * zk-v1: agent should use decryptMemory() — no decompression step
 * The version field is returned in the response so the agent can branch correctly.
 *
 * ─── Revocation model ────────────────────────────────────────────────────────
 * Revocation controls the managed access path. Full cryptographic revocation
 * (where even saved txIds become unrecoverable) requires threshold key management
 * — Lit Protocol mainnet is the production upgrade path.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, fallback, http } from "viem";
import { mainnet } from "viem/chains";
import { fetchFromArweave, StoredBlob } from "@/lib/arweave";
import { isRevokedCached, REVOCATION_CONTRACT, REVOCATION_ABI } from "@/lib/revoke-core";
import { tryResolveAddress } from "@/lib/ens";
import { logRecall } from "@/lib/activity-log";
import { getAgentAddress } from "@/lib/agent-info";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http("https://ethereum-rpc.publicnode.com"),
    http("https://cloudflare-eth.com"),
    http("https://rpc.ankr.com/eth"),
  ]),
});

// On-chain is authoritative — always check contract, use cache only as RPC fallback.
async function checkRevoked(ownerWallet: string, agentWallet: string): Promise<boolean> {
  const owner = ownerWallet.toLowerCase();
  const agent = agentWallet.toLowerCase();

  try {
    const revoked = await publicClient.readContract({
      address: REVOCATION_CONTRACT,
      abi: REVOCATION_ABI,
      functionName: "isRevoked",
      args: [ownerWallet as `0x${string}`, agentWallet as `0x${string}`],
    });
    return !!revoked;
  } catch (err) {
    console.warn("[/api/recall] On-chain revocation check failed, falling back to cache:", err);
    return isRevokedCached(owner, agent);
  }
}

/**
 * Detect backend from the storage identifier format:
 * - Arweave txId: 43-character base64url string (A-Za-z0-9_-)
 * - Filecoin IPFS CID: starts with "bafy", "Qm", or "bafk"
 */
function detectBackend(id: string): "arweave" | "filecoin" {
  if (/^[A-Za-z0-9_-]{43}$/.test(id)) return "arweave";
  if (id.startsWith("bafy") || id.startsWith("Qm") || id.startsWith("bafk")) return "filecoin";
  // Fallback: try Arweave — if it fails, caller handles the error
  return "arweave";
}

async function fetchFromFilecoinLegacy(cid: string): Promise<StoredBlob> {
  const gateways = [
    `https://gateway.lighthouse.storage/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
  ];
  let lastError: Error | null = null;
  for (const url of gateways) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      return await res.json() as StoredBlob;
    } catch (e) {
      lastError = e as Error;
    }
  }
  throw lastError ?? new Error(`Failed to fetch legacy CID ${cid} from all IPFS gateways`);
}

export async function POST(req: NextRequest) {
  const defaultAgent = getAgentAddress();
  let storageId = "";

  try {
    const body = await req.json();

    // Accept both "txId" (new) and "cid" (legacy alias)
    const { txId, cid, ownerWallet: rawOwner, agentWallet: rawAgent } = body as {
      txId?: string;
      cid?: string;
      ownerWallet?: string;
      agentWallet?: string;
    };
    storageId = txId ?? cid ?? "";

    if (!storageId || typeof storageId !== "string") {
      return NextResponse.json({ error: "txId (or cid) is required" }, { status: 400 });
    }

    // 1. Fetch blob — route to correct backend based on storage ID format
    const backend = detectBackend(storageId);
    let blob: StoredBlob;

    if (backend === "filecoin") {
      blob = await fetchFromFilecoinLegacy(storageId);
    } else {
      blob = await fetchFromArweave(storageId);
    }

    // 2. Resolve owner wallet — blob metadata is source of truth
    const rawOwnerSource = blob.ownerWallet ?? blob.wallet ?? rawOwner;
    const ownerAddress = rawOwnerSource ? await tryResolveAddress(rawOwnerSource) : null;

    // 3. Resolve agent wallet — blob metadata, then caller-supplied, then default
    const rawAgentSource = blob.agentWallet ?? rawAgent ?? defaultAgent;
    const agentAddress = (await tryResolveAddress(rawAgentSource)) ?? defaultAgent;

    // 4. Check revocation — deny before returning any ciphertext
    if (ownerAddress) {
      const revoked = await checkRevoked(ownerAddress.toLowerCase(), agentAddress.toLowerCase());
      if (revoked) {
        logRecall({ agentWallet: agentAddress, ownerWallet: ownerAddress ?? undefined, cid: storageId, success: false, denied: true });
        return NextResponse.json(
          { status: "denied", reason: "Access revoked by owner" },
          { status: 403 }
        );
      }
    }

    // 5. Check this is a valid ZK-format blob (v1 or v2)
    if (!blob.encryptedBlob) {
      // Legacy Lit-format blob — unrecoverable
      logRecall({ agentWallet: agentAddress, ownerWallet: ownerAddress ?? undefined, cid: storageId, success: false });
      return NextResponse.json(
        {
          error: "Legacy Lit-format blob — unrecoverable after network migration. Store a new memory.",
          status: "legacy",
        },
        { status: 410 }
      );
    }

    // 6. Return the encrypted blob — agent decrypts (and optionally decompresses) locally
    logRecall({ agentWallet: agentAddress, ownerWallet: ownerAddress ?? undefined, cid: storageId, success: true });

    return NextResponse.json({
      encryptedBlob: blob.encryptedBlob,
      agentWallet: agentAddress,
      ownerWallet: ownerAddress ?? blob.ownerWallet,
      // Return version so the agent knows whether to decompress after decryption
      version: blob.version ?? "zk-v1",
      backend,
      txId: storageId,
      status: "stored",
    });
  } catch (err) {
    console.error("[/api/recall] Error:", err);
    logRecall({ agentWallet: defaultAgent, cid: storageId, success: false });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
