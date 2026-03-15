/**
 * POST /api/remember
 * Stores a pre-encrypted memory blob on Filecoin.
 *
 * MimirWell is zero-knowledge — this server never sees plaintext.
 * Agents encrypt locally before calling this endpoint.
 *
 * Body: {
 *   encryptedBlob: string   // base64 AES-256-GCM blob from agent-crypto.ts
 *   ownerWallet:   string   // hex address or ENS name (revocation authority)
 *   agentWallet?:  string   // hex address or ENS name (defaults to ThorAI's wallet)
 * }
 *
 * Returns: { cid, agentWallet, manifestCid, status: "stored" }
 *
 * ─── Agent reference implementation ─────────────────────────────────────────
 * See lib/agent-crypto.ts for the copy-paste encryption functions.
 *
 * curl -X POST https://mimirwell.net/api/remember \
 *   -H "Content-Type: application/json" \
 *   -d '{"encryptedBlob":"<base64>","ownerWallet":"trav.eth","agentWallet":"<your-wallet>"}'
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadToFilecoin } from "@/lib/lighthouse";
import { registerCID, uploadManifest } from "@/lib/cid-registry";
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
    } = body as {
      encryptedBlob: string;
      ownerWallet: string;
      agentWallet?: string;
    };

    if (!encryptedBlob || typeof encryptedBlob !== "string") {
      return NextResponse.json({ error: "encryptedBlob is required" }, { status: 400 });
    }
    if (!rawOwner || typeof rawOwner !== "string") {
      return NextResponse.json({ error: "ownerWallet is required" }, { status: 400 });
    }

    // Resolve ENS names → hex addresses
    const ownerAddress = await resolveAddress(rawOwner);
    const agentAddress = rawAgent ? await resolveAddress(rawAgent) : getAgentAddress();

    // Build storage blob — zero-knowledge: only encrypted content stored
    const blob = {
      encryptedBlob,
      agentWallet: agentAddress.toLowerCase(),
      ownerWallet: ownerAddress.toLowerCase(),
      timestamp: Date.now(),
      version: "zk-v1",
    };

    // Upload to Filecoin via Lighthouse
    const { cid, url } = await uploadToFilecoin(blob);

    // Register in local CID index
    registerCID({
      cid,
      agentWallet: agentAddress,
      ownerWallet: ownerAddress,
      timestamp: Date.now(),
      preview: "[encrypted]",
    });

    // Log to activity feed (first 48 chars of encryptedBlob for terminal display)
    logRemember({
      agentWallet: agentAddress,
      ownerWallet: ownerAddress,
      cid,
      ciphertext: encryptedBlob,
    });

    // Upload updated manifest to Filecoin (async, non-blocking)
    let manifestCid: string | null = null;
    try {
      manifestCid = await uploadManifest();
    } catch (manifestErr) {
      console.warn("[/api/remember] Manifest upload failed (non-fatal):", manifestErr);
    }

    return NextResponse.json({
      cid,
      url,
      agentWallet: agentAddress,
      manifestCid,
      status: "stored",
    });
  } catch (err) {
    console.error("[/api/remember] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
