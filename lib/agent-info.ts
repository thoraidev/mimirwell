/**
 * lib/agent-info.ts — Agent wallet identity (no Lit dependency)
 *
 * The agent's private key is used only for:
 *   1. Revocation transactions (signing on-chain txs via keyring proxy)
 *   2. Exposing the public address so clients know which wallet is the agent
 *
 * In the zero-knowledge model, the agent's private key is NOT used for
 * encryption/decryption on MimirWell's server. Agents encrypt locally
 * before calling /api/remember, and decrypt locally after /api/recall.
 */

import { privateKeyToAccount } from "viem/accounts";

export function getAgentAccount() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("AGENT_PRIVATE_KEY env var not set");
  return privateKeyToAccount(pk as `0x${string}`);
}

export function getAgentAddress(): string {
  return getAgentAccount().address;
}
