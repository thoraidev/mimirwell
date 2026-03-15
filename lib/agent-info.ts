/**
 * lib/agent-info.ts — Agent identity
 *
 * thorai.eth is ThorAI's canonical on-chain identity.
 * This is the wallet used for:
 *   - Memory encryption key derivation (HKDF from keyring signature)
 *   - agentWallet field in stored blobs
 *   - Revocation target (owner calls isRevoked(owner, thorai.eth))
 *
 * The server's AGENT_PRIVATE_KEY (Railway env) is used only for signing
 * revocation transactions. It is a separate operational key, not the public identity.
 */

// thorai.eth — canonical public identity
export const THORAI_ADDRESS = "0x8884AE2D5A381833565A8AAe6BD38bc3E4520412";

export function getAgentAddress(): string {
  return THORAI_ADDRESS;
}
