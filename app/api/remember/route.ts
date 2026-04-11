/**
 * POST /api/remember
 * Stores a pre-encrypted memory blob permanently on Arweave.
 *
 * MimirWell is zero-knowledge — this server never sees plaintext.
 * Agents encrypt (and optionally compress) locally before calling this endpoint.
 *
 * ─── zk-v2 (recommended — Arweave free tier) ────────────────────────────────
 * Agents should use compressAndEncryptMemory() from lib/agent-crypto.ts before
 * calling this endpoint. gzip + AES-256-GCM keeps blobs under 90 KB, which
 * qualifies for Arweave Turbo's permanent free storage threshold (100 KiB).
 *
 * ─── Two integration paths ───────────────────────────────────────────────────
 * Sovereign storage (default): omit ownerWallet entirely.
 *   - Pure permanent storage. No revocation. No Ethereum dependency.
 *   - Agent can retrieve directly from arweave.net/<txId> forever.
 *
 * Storage with human oversight: include ownerWallet.
 *   - Human principal can call revoke(agentAddress) on the Ethereum contract.
 *   - /api/recall enforces revocation by checking the contract before returning.
 *
 * Body: {
 *   encryptedBlob: string   // base64 AES-256-GCM blob from agent-crypto.ts
 *   agentWallet?:  string   // hex address or ENS name (defaults to ThorAI's wallet)
 *   ownerWallet?:  string   // hex address or ENS name — opt-in human oversight
 *   version?:      string   // "zk-v1" or "zk-v2" (default: "zk-v2")
 * }
 *
 * Returns: { txId, agentWallet, status: "stored" }
 *
 * ─── Agent reference implementation ─────────────────────────────────────────
 * See lib/agent-crypto.ts for compressAndEncryptMemory() (v2) or
 * encryptMemory() (v1).
 *
 * curl -X POST https://mimirwell.net/api/remember \
 *   -H "Content-Type: application/json" \
 *   -d '{"encryptedBlob":"<base64>","ownerWallet":"trav.eth","agentWallet":"<your-wallet>","version":"zk-v2"}'
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadToArweave, MAX_UPLOAD_BYTES } from "@/lib/arweave";
import { registerTxId } from "@/lib/cid-registry";
import { resolveAddress } from "@/lib/ens";
import { logRemember } from "@/lib/activity-log";
import { getAgentAddress } from "@/lib/agent-info";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      encryptedBlob,
      ownerWallet: rawOwner,
      agentWallet: rawAgent,
      version: rawVersion,
    } = body as {
      encryptedBlob: string;
      ownerWallet: string;
      agentWallet?: string;
      version?: string;
    };

    if (!encryptedBlob || typeof encryptedBlob !== "string") {
      return NextResponse.json({ error: "encryptedBlob is required" }, { status: 400 });
    }

    // Resolve ENS names → hex addresses
    // ownerWallet is optional — omitting it selects sovereign storage (no revocation)
    const ownerAddress: string | null = rawOwner ? await resolveAddress(rawOwner) : null;
    const agentAddress: string = (rawAgent ? await resolveAddress(rawAgent) : null) ?? getAgentAddress();

    // Default to zk-v2 for new uploads
    const version = rawVersion ?? "zk-v2";

    // Build storage blob — zero-knowledge: only encrypted content stored
    // ownerWallet omitted when not provided — sovereign storage path
    const blob: Record<string, unknown> = {
      encryptedBlob,
      agentWallet: agentAddress.toLowerCase(),
      timestamp: Date.now(),
      version,
    };
    if (ownerAddress) {
      blob.ownerWallet = ownerAddress.toLowerCase();
    }

    // Guard: reject if blob exceeds the Arweave free-tier threshold before uploading
    const approxSize = Buffer.byteLength(JSON.stringify(blob), "utf8");
    if (approxSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Blob too large: ${approxSize} bytes (max ${MAX_UPLOAD_BYTES}). ` +
            "Use compressAndEncryptMemory() (zk-v2) to stay under the free threshold.",
        },
        { status: 413 }
      );
    }

    // Upload to Arweave via Turbo (permanent, free under 100 KiB)
    const { txId, url } = await uploadToArweave(blob);

    // Register in local txId index (fast lookup; GraphQL is the recovery path)
    registerTxId({
      txId,
      agentWallet: agentAddress,
      ownerWallet: ownerAddress ?? undefined,
      timestamp: Date.now(),
      preview: "[encrypted]",
    });

    // Log to activity feed
    logRemember({
      agentWallet: agentAddress,
      ownerWallet: ownerAddress ?? undefined,
      cid: txId, // activity-log field named "cid" for historical compat
      ciphertext: encryptedBlob,
    });

    return NextResponse.json({
      txId,
      url,
      agentWallet: agentAddress,
      status: "stored",
      backend: "arweave",
      // Indicate which path was used
      oversight: ownerAddress ? true : false,
    });
  } catch (err) {
    console.error("[/api/remember] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
