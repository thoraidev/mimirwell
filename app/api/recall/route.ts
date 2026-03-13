/**
 * POST /api/recall
 * Fetches encrypted blob from Filecoin and decrypts via Lit Protocol.
 *
 * Body: { cid: string, wallet: string, authSig?: object }
 * Returns: { content: string, status: "decrypted" }
 *       OR { status: "denied", reason: "Access revoked" }
 */

import { NextRequest, NextResponse } from "next/server";
import { decryptMemory, type EncryptedMemory } from "@/lib/lit";
import { fetchFromFilecoin } from "@/lib/lighthouse";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cid, wallet, authSig } = body as {
      cid: string;
      wallet: string;
      authSig?: Record<string, unknown>;
    };

    if (!cid || typeof cid !== "string") {
      return NextResponse.json({ error: "cid is required" }, { status: 400 });
    }
    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ error: "wallet address is required" }, { status: 400 });
    }
    if (!authSig || typeof authSig !== "object") {
      return NextResponse.json(
        { error: "authSig is required for decryption (EIP-4361 signature from wallet)" },
        { status: 400 }
      );
    }

    // 1. Fetch encrypted blob from Filecoin
    const blob = await fetchFromFilecoin(cid);

    // Verify the blob belongs to the requesting wallet
    if (blob.wallet && blob.wallet.toLowerCase() !== wallet.toLowerCase()) {
      return NextResponse.json(
        { status: "denied", reason: "Access revoked" },
        { status: 403 }
      );
    }

    // 2. Build EncryptedMemory object
    const encrypted: EncryptedMemory = {
      ciphertext: blob.ciphertext,
      dataToEncryptHash: blob.dataToEncryptHash,
      accessControlConditions: blob.accessControlConditions as EncryptedMemory["accessControlConditions"],
    };

    // 3. Decrypt via Lit Protocol
    try {
      const content = await decryptMemory(encrypted, authSig);
      return NextResponse.json({ content, status: "decrypted" });
    } catch (litErr) {
      const msg = litErr instanceof Error ? litErr.message : String(litErr);
      const isAccessDenied =
        msg.toLowerCase().includes("not authorized") ||
        msg.toLowerCase().includes("access denied") ||
        msg.toLowerCase().includes("revoked");

      if (isAccessDenied) {
        return NextResponse.json(
          { status: "denied", reason: "Access revoked" },
          { status: 403 }
        );
      }
      throw litErr;
    }
  } catch (err) {
    console.error("[/api/recall] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
