/**
 * GET /api/ens-forward?name=gokus.eth
 *
 * Forward-resolves an ENS name to its wallet address.
 * Uses the server-side viem client (publicnode.com) — reliable, bypasses wagmi transport.
 *
 * Returns:
 *   { address: "0x…", name: "gokus.eth" }                   — resolved
 *   { address: null, error: "not_found" }  (404)             — name not registered / no resolver
 *   { address: null, error: "rpc_error"  } (502)             — RPC failure
 */

import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { resolveAddress } from "@/lib/ens";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name parameter required" }, { status: 400 });
  }

  const trimmed = name.trim();

  // Already a valid hex address — pass through directly
  if (isAddress(trimmed)) {
    return NextResponse.json({ address: trimmed, name: trimmed });
  }

  try {
    const address = await resolveAddress(trimmed);
    return NextResponse.json({ address, name: trimmed }, {
      headers: { "Cache-Control": "public, max-age=300" }, // 5 min — ENS records rarely change
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // resolveAddress throws "could not be resolved" when ENS returns null (not registered)
    const isNotFound = msg.includes("could not be resolved") || msg.includes("not found");
    return NextResponse.json(
      { address: null, name: trimmed, error: isNotFound ? "not_found" : "rpc_error" },
      { status: isNotFound ? 404 : 502 }
    );
  }
}
