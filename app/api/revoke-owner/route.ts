/**
 * POST /api/revoke-owner
 *
 * Internal endpoint for the demo panel — no API secret header required.
 * Security is enforced by the keyring proxy: the signer MUST be the ownerWallet.
 * If the keyring wallet does not match ownerWallet, the request is rejected.
 *
 * Use /api/revoke (with X-MimirWell-Secret) for external/programmatic access.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Inject the API secret server-side and forward to the main revoke route
    const secret = process.env.MIMIRWELL_API_SECRET ?? "";

    const res = await fetch(new URL("/api/revoke", req.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MimirWell-Secret": secret,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
