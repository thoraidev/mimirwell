/**
 * POST /api/remember
 * Encrypts content with Lit Protocol (to the agent's wallet) and stores on Filecoin.
 *
 * Body: { content: string, wallet: string }
 *   wallet = the human owner's address (stored for provenance / revoke checks)
 *
 * Returns: { cid: string, agentWallet: string, manifestCid: string, status: "stored" }
 */

import { NextRequest, NextResponse } from "next/server";
import { encryptMemory, getAgentAddress } from "@/lib/lit";
import { uploadToFilecoin } from "@/lib/lighthouse";
import { registerCID, uploadManifest } from "@/lib/cid-registry";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, wallet, agentWallet: customAgentWallet } = body as {
      content: string;
      wallet: string;
      agentWallet?: string; // optional — external agents pass their own wallet here
    };

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ error: "wallet address is required" }, { status: 400 });
    }

    // If agentWallet is provided, encrypt to that wallet (external agent use case).
    // Otherwise, default to ThorAI's own agent wallet (self-hosted use case).
    const agentAddress = customAgentWallet ?? getAgentAddress();

    // 1. Encrypt with Lit Protocol — access controlled to the agent's wallet
    const encrypted = await encryptMemory(content, agentAddress);

    // 2. Build storage blob
    const blob = {
      ciphertext: encrypted.ciphertext,
      dataToEncryptHash: encrypted.dataToEncryptHash,
      accessControlConditions: encrypted.accessControlConditions,
      agentWallet: agentAddress.toLowerCase(),
      ownerWallet: wallet.toLowerCase(),
      timestamp: Date.now(),
    };

    // 3. Upload to Filecoin via Lighthouse
    const { cid, url } = await uploadToFilecoin(blob);

    // 4. Register in local CID index
    registerCID({
      cid,
      agentWallet: agentAddress,
      ownerWallet: wallet,
      timestamp: Date.now(),
      preview: content.slice(0, 80),
    });

    // 5. Upload updated manifest to Filecoin (async, non-blocking)
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
      encryptedData: {
        ciphertext: encrypted.ciphertext,
        dataToEncryptHash: encrypted.dataToEncryptHash,
      },
      status: "stored",
    });
  } catch (err) {
    console.error("[/api/remember] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
