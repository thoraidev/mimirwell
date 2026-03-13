/**
 * POST /api/recall
 * Fetches encrypted blob from Filecoin and decrypts via Lit Protocol using the agent's key.
 *
 * Body: { cid: string, ownerWallet?: string }
 * Returns: { content: string, status: "decrypted" }
 *       OR { status: "denied", reason: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { decryptWithAgentKey, getAgentAddress, type EncryptedMemory } from "@/lib/lit";
import { fetchFromFilecoin } from "@/lib/lighthouse";
import { isRevoked } from "@/app/api/revoke/route";
import { tryResolveAddress } from "@/lib/ens";
import { logRecall } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  const agentAddress = getAgentAddress();
  let cid = "";

  try {
    const body = await req.json();
    const { cid: rawCid, ownerWallet: rawOwner } = body as {
      cid: string;
      ownerWallet?: string;
    };
    cid = rawCid;

    if (!cid || typeof cid !== "string") {
      return NextResponse.json({ error: "cid is required" }, { status: 400 });
    }

    // 1. Fetch encrypted blob from Filecoin
    const blob = await fetchFromFilecoin(cid);

    // 2. Resolve owner wallet (ENS or hex)
    const rawOwnerFromBlob = rawOwner ?? blob.ownerWallet ?? blob.wallet;
    const ownerAddress = rawOwnerFromBlob
      ? await tryResolveAddress(rawOwnerFromBlob)
      : null;

    // 3. Check revocation cache (on-chain source of truth checked by Lit at decrypt time)
    if (ownerAddress && isRevoked(ownerAddress.toLowerCase(), agentAddress.toLowerCase())) {
      logRecall({ agentWallet: agentAddress, cid, success: false, denied: true });
      return NextResponse.json(
        { status: "denied", reason: "Access revoked by owner" },
        { status: 403 }
      );
    }

    // 4. Build EncryptedMemory object
    const encrypted: EncryptedMemory = {
      ciphertext: blob.ciphertext,
      dataToEncryptHash: blob.dataToEncryptHash,
      accessControlConditions: blob.accessControlConditions,
      chain: "ethereum",
    };

    // 5. Decrypt server-side using the agent's private key
    // Lit Protocol enforces the ACC (including contract revocation check) here
    try {
      const content = await decryptWithAgentKey(encrypted);
      logRecall({ agentWallet: agentAddress, cid, success: true });
      return NextResponse.json({ content, agentWallet: agentAddress, status: "decrypted" });
    } catch (litErr) {
      const msg = litErr instanceof Error ? litErr.message : String(litErr);
      const isAccessDenied =
        msg.toLowerCase().includes("not authorized") ||
        msg.toLowerCase().includes("access denied") ||
        msg.toLowerCase().includes("revoked") ||
        msg.toLowerCase().includes("unauthorized");

      if (isAccessDenied) {
        logRecall({ agentWallet: agentAddress, cid, success: false, denied: true });
        return NextResponse.json(
          { status: "denied", reason: "Access revoked or unauthorized" },
          { status: 403 }
        );
      }
      throw litErr;
    }
  } catch (err) {
    console.error("[/api/recall] Error:", err);
    logRecall({ agentWallet: agentAddress, cid, success: false });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
