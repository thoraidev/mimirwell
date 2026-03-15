/**
 * GET /api/is-revoked?owner=0x…&agent=0x…
 *
 * Checks whether ownerWallet has revoked agentWallet on-chain.
 * Uses the server-side viem client (publicnode.com) — reliable, bypasses wagmi transport.
 *
 * Returns:
 *   { owner: "0x…", agent: "0x…", revoked: true | false }
 *   { error: "…" } (400 / 502)
 */

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { REVOCATION_CONTRACT, REVOCATION_ABI } from "@/lib/revoke-core";

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://ethereum-rpc.publicnode.com"),
});

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");
  const agent = req.nextUrl.searchParams.get("agent");

  if (!owner || !agent || !isAddress(owner) || !isAddress(agent)) {
    return NextResponse.json(
      { error: "owner and agent must be valid hex addresses (0x…)" },
      { status: 400 }
    );
  }

  try {
    const revoked = await client.readContract({
      address: REVOCATION_CONTRACT,
      abi: REVOCATION_ABI,
      functionName: "isRevoked",
      args: [owner as `0x${string}`, agent as `0x${string}`],
    });

    return NextResponse.json({ owner, agent, revoked: !!revoked }, {
      headers: { "Cache-Control": "no-store" }, // Always fresh — revocation state changes
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/is-revoked]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
