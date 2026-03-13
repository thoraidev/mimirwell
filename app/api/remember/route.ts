/**
 * POST /api/remember
 * Encrypts content with Lit Protocol (to the agent's wallet) and stores on Filecoin.
 *
 * Body: { content: string, wallet: string }
 *   wallet = the human owner's address (stored for provenance / revoke checks)
 *
 * Returns: { cid: string, agentWallet: string, status: "stored" }
 */

import { NextRequest, NextResponse } from "next/server";
import { encryptMemory, getAgentAddress } from "@/lib/lit";
import { uploadToFilecoin } from "@/lib/lighthouse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, wallet } = body as { content: string; wallet: string };

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }
    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ error: "wallet address is required" }, { status: 400 });
    }

    // The agent's wallet is the decryption key holder —
    // memories are encrypted TO the agent so it can recall them autonomously.
    const agentAddress = getAgentAddress();

    // 1. Encrypt with Lit Protocol — access controlled to the agent's wallet
    const encrypted = await encryptMemory(content, agentAddress);

    // 2. Build storage blob (also stores owner wallet for revoke checks)
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

    return NextResponse.json({
      cid,
      url,
      agentWallet: agentAddress,
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
