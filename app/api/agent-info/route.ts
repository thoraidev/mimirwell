/**
 * GET /api/agent-info
 * Returns the agent's public wallet address.
 * Safe to expose — public key only, never the private key.
 */

import { NextResponse } from "next/server";
import { getAgentAddress } from "@/lib/lit";

export async function GET() {
  try {
    const agentWallet = getAgentAddress();
    return NextResponse.json({ agentWallet });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
