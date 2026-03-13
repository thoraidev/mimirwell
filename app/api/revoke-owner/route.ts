/**
 * POST /api/revoke-owner
 *
 * Internal endpoint for the demo panel. Injects MIMIRWELL_API_SECRET server-side
 * so the browser never needs to hold it.
 *
 * Security model:
 * - Origin/Referer check: only accepts requests from mimirwell.net or localhost
 * - The real auth is the keyring: signer MUST equal ownerWallet, enforced in /api/revoke
 * - If ownerWallet ≠ keyring wallet, /api/revoke returns 403 regardless
 *
 * This endpoint does NOT expose any secrets in its response.
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "https://mimirwell.net",
  "https://www.mimirwell.net",
  "https://mimirwell-production.up.railway.app",
];

function isAllowedOrigin(req: NextRequest): boolean {
  // In development (localhost) always allow
  const origin = req.headers.get("origin") ?? "";
  const referer = req.headers.get("referer") ?? "";
  if (origin.startsWith("http://localhost") || referer.startsWith("http://localhost")) return true;
  // Check allowed origins
  return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed) || referer.startsWith(allowed));
}

export async function POST(req: NextRequest) {
  // Origin guard — rejects requests from outside the app
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Inject the API secret server-side — never exposed to the client
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
    // Strip any internal fields before returning
    const { status, agentWallet, ownerWallet, txHash, blockNumber, etherscan, revokedAt, error } = data;
    return NextResponse.json(
      { status, agentWallet, ownerWallet, txHash, blockNumber, etherscan, revokedAt, error },
      { status: res.status }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
