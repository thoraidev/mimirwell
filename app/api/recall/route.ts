/**
 * POST /api/recall
 * Fetches encrypted blob from Filecoin and decrypts via Lit Protocol using the agent's key.
 *
 * Body: { cid: string, ownerWallet?: string }
 * Returns: { content: string, status: "decrypted" }
 *       OR { status: "denied", reason: "..." }
 *
 * Revocation check: in-memory cache first (fast), then on-chain contract (fallback).
 * This means browser-wallet or Etherscan revokes are honoured automatically.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { decryptWithAgentKey, getAgentAddress, type EncryptedMemory } from "@/lib/lit";
import { fetchFromFilecoin } from "@/lib/lighthouse";
import { isRevokedCached, REVOCATION_CONTRACT, REVOCATION_ABI } from "@/lib/revoke-core";
import { tryResolveAddress } from "@/lib/ens";
import { logRecall } from "@/lib/activity-log";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});

// Check revocation: cache first, then on-chain fallback
async function checkRevoked(ownerWallet: string, agentWallet: string): Promise<boolean> {
  const owner = ownerWallet.toLowerCase();
  const agent = agentWallet.toLowerCase();

  // Fast path: in-memory cache
  if (isRevokedCached(owner, agent)) return true;

  // Slow path: query the contract directly
  // This honours revokes done via MetaMask, Etherscan, or any external wallet
  try {
    const revoked = await publicClient.readContract({
      address: REVOCATION_CONTRACT,
      abi: REVOCATION_ABI,
      functionName: "isRevoked",
      args: [ownerWallet as `0x${string}`, agentWallet as `0x${string}`],
    });
    return !!revoked;
  } catch (err) {
    console.warn("[/api/recall] On-chain revocation check failed (non-fatal):", err);
    return false; // fail open — better than blocking valid recalls
  }
}

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

    // 2. Resolve owner wallet — prefer value stored in blob (source of truth)
    //    Falls back to caller-supplied value, then blob.wallet field
    const rawOwnerFromBlob = blob.ownerWallet ?? blob.wallet ?? rawOwner;
    const ownerAddress = rawOwnerFromBlob
      ? await tryResolveAddress(rawOwnerFromBlob)
      : null;

    // 3. Check revocation — cache + on-chain fallback
    if (ownerAddress) {
      const revoked = await checkRevoked(ownerAddress.toLowerCase(), agentAddress.toLowerCase());
      if (revoked) {
        logRecall({ agentWallet: agentAddress, cid, success: false, denied: true });
        return NextResponse.json(
          { status: "denied", reason: "Access revoked by owner" },
          { status: 403 }
        );
      }
    }

    // 4. Build EncryptedMemory object
    const encrypted: EncryptedMemory = {
      ciphertext: blob.ciphertext,
      dataToEncryptHash: blob.dataToEncryptHash,
      accessControlConditions: blob.accessControlConditions,
      chain: "ethereum",
    };

    // 5. Decrypt server-side using the agent's private key
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
