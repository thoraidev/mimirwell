/**
 * GET /api/activity
 * Returns the last 20 activity events for the live terminal component.
 * No auth required — nothing sensitive exposed (truncated wallets/CIDs, cipher fragments).
 * Includes ENS reverse-resolution for wallet addresses (cached in-process).
 */

import { NextResponse } from "next/server";
import { getRecentActivity } from "@/lib/activity-log";
import { lookupAddress } from "@/lib/ens";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = getRecentActivity(20);

    // Collect unique full addresses across all events for batch ENS resolution
    const addressSet = new Set<string>();
    for (const e of events) {
      if (e.agentWalletFull) addressSet.add(e.agentWalletFull);
      if (e.ownerWalletFull) addressSet.add(e.ownerWalletFull);
    }

    // Resolve all unique addresses in parallel (lookupAddress is internally cached)
    const nameMap = new Map<string, string | null>();
    await Promise.all(
      [...addressSet].map(async (addr) => {
        const name = await lookupAddress(addr);
        nameMap.set(addr.toLowerCase(), name);
      })
    );

    // Enrich events — use full address for ENS lookup, fall back gracefully
    const enriched = events.map((e) => ({
      ...e,
      agentWalletName: e.agentWalletFull
        ? (nameMap.get(e.agentWalletFull.toLowerCase()) ?? null)
        : null,
      ownerWalletName: e.ownerWalletFull
        ? (nameMap.get(e.ownerWalletFull.toLowerCase()) ?? null)
        : null,
    }));

    return NextResponse.json({ events: enriched });
  } catch (err) {
    console.error("[/api/activity] Error:", err);
    return NextResponse.json({ events: [] });
  }
}
