/**
 * GET /api/memories?agentWallet=0x...&ownerWallet=0x...
 * Returns the CID index for an agent — all stored memory CIDs.
 * Useful for agents that need to rediscover their memories after a restart.
 */

import { NextRequest, NextResponse } from "next/server";
import { listCIDs, getRegistry } from "@/lib/cid-registry";

export async function GET(req: NextRequest) {
  const agentWallet = req.nextUrl.searchParams.get("agentWallet") ?? undefined;
  const ownerWallet = req.nextUrl.searchParams.get("ownerWallet") ?? undefined;

  const entries = listCIDs(agentWallet, ownerWallet);
  const registry = getRegistry();

  return NextResponse.json({
    entries,
    count: entries.length,
    rootManifestCid: registry.rootManifestCid,
    lastUpdated: registry.lastUpdated,
  });
}
