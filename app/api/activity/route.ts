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

    // Resolve ENS names for all wallet addresses (cached — fast after first call)
    const enriched = await Promise.all(
      events.map(async (e) => {
        const [agentName, ownerName] = await Promise.all([
          e.agentWallet ? lookupAddress(e.agentWallet) : Promise.resolve(null),
          e.ownerWallet ? lookupAddress(e.ownerWallet) : Promise.resolve(null),
        ]);
        return {
          ...e,
          agentWalletName: agentName ?? null,
          ownerWalletName: ownerName ?? null,
        };
      })
    );

    return NextResponse.json({ events: enriched });
  } catch (err) {
    console.error("[/api/activity] Error:", err);
    return NextResponse.json({ events: [] });
  }
}
