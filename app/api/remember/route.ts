/**
 * POST /api/remember
 * Encrypts content with Lit Protocol and stores on Filecoin via Lighthouse.
 *
 * Body: { content: string, wallet: string }
 * Returns: { cid: string, encryptedData: object, status: "stored" }
 */

import { NextRequest, NextResponse } from "next/server";
import { encryptMemory } from "@/lib/lit";
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

    // 1. Encrypt with Lit Protocol (nagaDev)
    const encrypted = await encryptMemory(content, wallet.toLowerCase());

    // 2. Build storage blob
    const blob = {
      ciphertext: encrypted.ciphertext,
      dataToEncryptHash: encrypted.dataToEncryptHash,
      accessControlConditions: encrypted.accessControlConditions,
      wallet: wallet.toLowerCase(),
      timestamp: Date.now(),
    };

    // 3. Upload to Filecoin via Lighthouse
    const { cid, url } = await uploadToFilecoin(blob);

    return NextResponse.json({
      cid,
      url,
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
