/**
 * GET /api/recall/challenge?agentWallet=0x...
 *
 * Returns a SIWE message for the agent to sign with their private key.
 * The signature is then passed to POST /api/recall as authSig.
 *
 * This enables ANY agent with an Ethereum wallet to use MimirWell —
 * their private key never leaves their server.
 *
 * Flow:
 *   1. GET /api/recall/challenge?agentWallet=0x...
 *      ← { nonce, siweMessage, expiresAt }
 *
 *   2. Agent signs siweMessage with their private key locally
 *      → { sig, address, signedMessage }
 *
 *   3. POST /api/recall { cid, authSig: { sig, address, signedMessage } }
 *      ← { content, status: "decrypted" }
 */

import { NextRequest, NextResponse } from "next/server";

// Simple in-memory nonce store (use Redis in production)
const _nonces = new Map<string, { nonce: string; expiresAt: number }>();

function generateNonce(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function GET(req: NextRequest) {
  const agentWallet = req.nextUrl.searchParams.get("agentWallet");

  if (!agentWallet || !/^0x[0-9a-fA-F]{40}$/.test(agentWallet)) {
    return NextResponse.json({ error: "valid agentWallet address required" }, { status: 400 });
  }

  const nonce = generateNonce();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  _nonces.set(agentWallet.toLowerCase(), { nonce, expiresAt });

  const now = new Date();
  const expiry = new Date(expiresAt);

  // Standard SIWE message format Lit Protocol expects
  const siweMessage = [
    `mimirwell.net wants you to sign in with your Ethereum account:`,
    agentWallet,
    ``,
    `I authorize MimirWell to decrypt memories for this agent.`,
    ``,
    `URI: https://mimirwell.net`,
    `Version: 1`,
    `Chain ID: 1`,
    `Nonce: ${nonce}`,
    `Issued At: ${now.toISOString()}`,
    `Expiration Time: ${expiry.toISOString()}`,
  ].join("\n");

  return NextResponse.json({
    agentWallet,
    nonce,
    siweMessage,
    expiresAt: expiry.toISOString(),
    instructions: "Sign siweMessage with your private key. Pass { sig, address, signedMessage } as authSig to POST /api/recall",
  });
}

// Export nonce validator for use by /api/recall
export function validateNonce(agentWallet: string, nonce: string): boolean {
  const key = agentWallet.toLowerCase();
  const stored = _nonces.get(key);
  if (!stored) return false;
  if (stored.nonce !== nonce) return false;
  if (Date.now() > stored.expiresAt) {
    _nonces.delete(key);
    return false;
  }
  _nonces.delete(key); // one-time use
  return true;
}
