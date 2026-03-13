/**
 * GET /api/ens-lookup?address=0x...
 *
 * Reverse-resolves an Ethereum address to its primary ENS name.
 * Returns { name: "thorai.eth" } or { name: null } if no primary name.
 * Results are cached in the server process.
 */

import { NextRequest, NextResponse } from "next/server";
import { lookupAddress } from "@/lib/ens";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address parameter required" }, { status: 400 });
  }
  try {
    const name = await lookupAddress(address);
    return NextResponse.json({ address, name }, {
      headers: { "Cache-Control": "public, max-age=300" }, // 5 min cache
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
