/**
 * POST /api/recall
 * Fetches an encrypted memory blob from Filecoin and returns it to the caller.
 *
 * MimirWell is zero-knowledge — this server never decrypts.
 * Revocation is enforced before returning the blob: a revoked agent
 * never receives the ciphertext, so it cannot decrypt even with its own key.
 *
 * Body: { cid: string, ownerWallet?: string, agentWallet?: string }
 *
 * Returns:
 *   { encryptedBlob: string, agentWallet: string, ownerWallet: string, status: "stored" }
 *   OR { status: "denied", reason: "..." }  (403)
 *
 * ─── Revocation model ────────────────────────────────────────────────────────
 * Revocation controls the managed access path — a revoked agent cannot
 * retrieve the blob through MimirWell. An agent that saved CIDs locally
 * and holds its own key can still decrypt previously-fetched blobs; this is
 * inherent to any agent-sovereign encryption scheme. Full cryptographic
 * revocation (where even saved CIDs become unrecoverable) requires threshold
 * key management — Lit Protocol mainnet is the production upgrade path.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, fallback, http } from "viem";
import { mainnet } from "viem/chains";
import { fetchFromFilecoin } from "@/lib/lighthouse";
import { isRevokedCached, REVOCATION_CONTRACT, REVOCATION_ABI } from "@/lib/revoke-core";
import { tryResolveAddress } from "@/lib/ens";
import { logRecall } from "@/lib/activity-log";
import { getAgentAddress } from "@/lib/agent-info";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http("https://ethereum-rpc.publicnode.com"),
    http("https://cloudflare-eth.com"),
    http("https://eth.llamarpc.com"),
  ]),
});

// On-chain is authoritative — always check contract, use cache only as RPC fallback.
// This ensures reinstates (MetaMask or server) take effect immediately.
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
    // RPC unreachable — fall back to in-memory cache
    console.warn("[/api/recall] On-chain revocation check failed, falling back to cache:", err);
    return isRevokedCached(owner, agent);
  }
}

export async function POST(req: NextRequest) {
  const defaultAgent = getAgentAddress();
  let cid = "";

  try {
    const body = await req.json();
    const { cid: rawCid, ownerWallet: rawOwner, agentWallet: rawAgent } = body as {
      cid: string;
      ownerWallet?: string;
      agentWallet?: string;
    };
    cid = rawCid;

    if (!cid || typeof cid !== "string") {
      return NextResponse.json({ error: "cid is required" }, { status: 400 });
    }

    // 1. Fetch blob from Filecoin
    const blob = await fetchFromFilecoin(cid);

    // 2. Resolve owner wallet — blob metadata is source of truth, caller-supplied is fallback
    const rawOwnerSource = blob.ownerWallet ?? blob.wallet ?? rawOwner;
    const ownerAddress = rawOwnerSource ? await tryResolveAddress(rawOwnerSource) : null;

    // 3. Resolve agent wallet — blob metadata, then caller-supplied, then default
    const rawAgentSource = blob.agentWallet ?? rawAgent ?? defaultAgent;
    const agentAddress = (await tryResolveAddress(rawAgentSource)) ?? defaultAgent;

    // 4. Check revocation — deny before returning any ciphertext
    if (ownerAddress) {
      const revoked = await checkRevoked(ownerAddress.toLowerCase(), agentAddress.toLowerCase());
      if (revoked) {
        logRecall({ agentWallet: agentAddress, ownerWallet: ownerAddress ?? undefined, cid, success: false, denied: true });
        return NextResponse.json(
          { status: "denied", reason: "Access revoked by owner" },
          { status: 403 }
        );
      }
    }

    // 5. Check this is a ZK-format blob
    if (!blob.encryptedBlob) {
      // Legacy Lit-format blob — cannot decrypt, return helpful error
      logRecall({ agentWallet: agentAddress, ownerWallet: ownerAddress ?? undefined, cid, success: false });
      return NextResponse.json(
        { error: "Legacy Lit-format blob — unrecoverable after network migration. Store a new memory.", status: "legacy" },
        { status: 410 }
      );
    }

    // 6. Return the encrypted blob — agent decrypts locally with its own key
    logRecall({ agentWallet: agentAddress, ownerWallet: ownerAddress ?? undefined, cid, success: true });

    return NextResponse.json({
      encryptedBlob: blob.encryptedBlob,
      agentWallet: agentAddress,
      ownerWallet: ownerAddress ?? blob.ownerWallet,
      status: "stored",
    });
  } catch (err) {
    console.error("[/api/recall] Error:", err);
    logRecall({ agentWallet: defaultAgent, cid, success: false }); // no owner — error path, blob may not have been fetched
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
