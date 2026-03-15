/**
 * GET /api/agent-info
 * Returns the agent's public identity.
 *
 * agentWallet = thorai.eth — ThorAI's canonical on-chain identity (keyring wallet).
 * This is the wallet used for:
 *   - Memory encryption key derivation (HKDF from wallet signature)
 *   - Revocation target shown in the DemoPanel
 *
 * Safe to expose — public address only.
 */

import { NextResponse } from "next/server";

// thorai.eth — ThorAI's public identity
const THORAI_ADDRESS = "0x8884AE2D5A381833565A8AAe6BD38bc3E4520412";

export async function GET() {
  return NextResponse.json({
    agentWallet: THORAI_ADDRESS,
    agentEns: "thorai.eth",
  });
}
