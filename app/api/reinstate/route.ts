/**
 * POST /api/reinstate
 * Reinstates a previously revoked agent wallet — on-chain via MimirWellRevocation contract.
 *
 * Body: { agentWallet: string, ownerWallet: string }
 *   Both fields accept hex addresses or ENS names.
 *
 * Headers: X-MimirWell-Secret (required when MIMIRWELL_API_SECRET env var is set)
 *
 * Returns: { status: "reinstated", txHash: string, etherscan: string, ... }
 */

import { NextRequest, NextResponse } from "next/server";
import { executeReinstate } from "@/lib/revoke-core";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentWallet: rawAgent, ownerWallet: rawOwner } = body as {
      agentWallet: string;
      ownerWallet: string;
    };

    if (!rawAgent || typeof rawAgent !== "string") {
      return NextResponse.json({ error: "agentWallet is required" }, { status: 400 });
    }
    if (!rawOwner || typeof rawOwner !== "string") {
      return NextResponse.json({ error: "ownerWallet is required" }, { status: 400 });
    }

    // Guard: require API secret for external callers
    const apiSecret = process.env.MIMIRWELL_API_SECRET;
    const callerSecret = req.headers.get("x-mimirwell-secret");
    if (apiSecret && callerSecret !== apiSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await executeReinstate(rawAgent, rawOwner);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/reinstate] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
