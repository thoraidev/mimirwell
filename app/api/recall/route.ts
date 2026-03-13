/**
 * POST /api/recall
 * Fetches encrypted blob from Filecoin and decrypts via Lit Protocol using the agent's key.
 * No browser wallet or authSig needed — the agent decrypts its own memories.
 *
 * Body: { cid: string, ownerWallet?: string }
 * Returns: { content: string, status: "decrypted" }
 *       OR { status: "denied", reason: "Access revoked" }
 */

import { NextRequest, NextResponse } from "next/server";
import { decryptWithAgentKey, getAgentAddress, type EncryptedMemory } from "@/lib/lit";
import { fetchFromFilecoin } from "@/lib/lighthouse";
import { isRevoked } from "@/app/api/revoke/route";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cid, ownerWallet } = body as {
      cid: string;
      ownerWallet?: string;
    };

    if (!cid || typeof cid !== "string") {
      return NextResponse.json({ error: "cid is required" }, { status: 400 });
    }

    // 1. Fetch encrypted blob from Filecoin
    const blob = await fetchFromFilecoin(cid);

    // 2. Check revocation — owner can revoke the agent's access
    const agentAddress = getAgentAddress();
    const resolvedOwner = ownerWallet ?? blob.ownerWallet ?? blob.wallet;

    if (resolvedOwner && isRevoked(resolvedOwner.toLowerCase(), agentAddress.toLowerCase())) {
      return NextResponse.json(
        { status: "denied", reason: "Access revoked by owner" },
        { status: 403 }
      );
    }

    // 3. Build EncryptedMemory object
    const encrypted: EncryptedMemory = {
      ciphertext: blob.ciphertext,
      dataToEncryptHash: blob.dataToEncryptHash,
      accessControlConditions: blob.accessControlConditions,
      chain: "ethereum",
    };

    // 4. Decrypt server-side using the agent's private key
    try {
      const content = await decryptWithAgentKey(encrypted);
      return NextResponse.json({ content, agentWallet: agentAddress, status: "decrypted" });
    } catch (litErr) {
      const msg = litErr instanceof Error ? litErr.message : String(litErr);
      const isAccessDenied =
        msg.toLowerCase().includes("not authorized") ||
        msg.toLowerCase().includes("access denied") ||
        msg.toLowerCase().includes("revoked") ||
        msg.toLowerCase().includes("unauthorized");

      if (isAccessDenied) {
        return NextResponse.json(
          { status: "denied", reason: "Access revoked or unauthorized" },
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
