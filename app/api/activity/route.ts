/**
 * GET /api/activity
 * Returns the last 20 activity events for the live terminal component.
 * No auth required — nothing sensitive exposed (truncated wallets/CIDs, cipher fragments).
 */

import { NextResponse } from "next/server";
import { getRecentActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = getRecentActivity(20);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[/api/activity] Error:", err);
    return NextResponse.json({ events: [] });
  }
}
