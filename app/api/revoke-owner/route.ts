/**
 * POST /api/revoke-owner
 *
 * Demo panel endpoint. No API secret required from the client.
 * Origin-guarded to prevent external griefing.
 * Calls executeRevoke() directly — no internal HTTP fetch.
 *
 * Real auth: keyring signer must equal ownerWallet (enforced in executeRevoke).
 */

import { NextRequest, NextResponse } from "next/server";
import { executeRevoke } from "@/lib/revoke-core";

const ALLOWED_ORIGINS = [
  "https://mimirwell.net",
  "https://www.mimirwell.net",
  "https://mimirwell-production.up.railway.app",
];

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin") ?? "";
  const referer = req.headers.get("referer") ?? "";
  if (origin.startsWith("http://localhost") || referer.startsWith("http://localhost")) return true;
  return ALLOWED_ORIGINS.some(
    (allowed) => origin.startsWith(allowed) || referer.startsWith(allowed)
  );
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { agentWallet, ownerWallet } = body as { agentWallet: string; ownerWallet: string };

    if (!agentWallet) return NextResponse.json({ error: "agentWallet is required" }, { status: 400 });
    if (!ownerWallet) return NextResponse.json({ error: "ownerWallet is required" }, { status: 400 });

    const result = await executeRevoke(agentWallet, ownerWallet);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/revoke-owner] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}
