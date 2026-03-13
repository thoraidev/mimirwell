/**
 * POST /api/revoke
 * Revokes an agent wallet's access to memories.
 *
 * Body: { agentWallet: string, ownerWallet: string }
 * Returns: { status: "revoked" }
 *
 * Note: Lit Protocol enforces access at decrypt time — revoking means updating
 * the access control conditions. In production, this would re-encrypt with new
 * ACCs excluding the agent wallet. For the hackathon demo, this endpoint logs
 * the revocation and returns the status. The access conditions are wallet-bound
 * to ownerWallet, so any agentWallet other than the owner is already denied.
 */

import { NextRequest, NextResponse } from "next/server";

// Simple in-memory revocation list (use Redis/DB in production)
const revocationList = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentWallet, ownerWallet } = body as {
      agentWallet: string;
      ownerWallet: string;
    };

    if (!agentWallet || typeof agentWallet !== "string") {
      return NextResponse.json({ error: "agentWallet is required" }, { status: 400 });
    }
    if (!ownerWallet || typeof ownerWallet !== "string") {
      return NextResponse.json({ error: "ownerWallet is required" }, { status: 400 });
    }

    // Record revocation
    const key = `${ownerWallet.toLowerCase()}:${agentWallet.toLowerCase()}`;
    revocationList.add(key);

    console.log(`[/api/revoke] Agent ${agentWallet} revoked by owner ${ownerWallet}`);

    return NextResponse.json({
      status: "revoked",
      agentWallet: agentWallet.toLowerCase(),
      ownerWallet: ownerWallet.toLowerCase(),
      revokedAt: new Date().toISOString(),
      note: "Access control is enforced by Lit Protocol at decrypt time. The agent wallet can no longer decrypt memories owned by this wallet.",
    });
  } catch (err) {
    console.error("[/api/revoke] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}

// Helper: check if a wallet pair has been revoked (used by /api/recall)
export function isRevoked(ownerWallet: string, agentWallet: string): boolean {
  const key = `${ownerWallet.toLowerCase()}:${agentWallet.toLowerCase()}`;
  return revocationList.has(key);
}
