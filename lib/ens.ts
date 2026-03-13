/**
 * lib/ens.ts — ENS name resolution for MimirWell API
 *
 * Accepts hex addresses or ENS names in any wallet field.
 * Uses Ethereum mainnet for resolution.
 */

import { createPublicClient, http, isAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum-rpc.publicnode.com'),
});

/**
 * Resolves an ENS name or hex address to a checksummed hex address.
 * Throws if ENS name not found.
 *
 * @example
 * await resolveAddress("thorai.eth")  // → "0x8884AE2D5A381833565A8AAe6BD38bc3E4520412"
 * await resolveAddress("0x8884...")    // → "0x8884..." (passthrough)
 */
export async function resolveAddress(input: string): Promise<`0x${string}`> {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid address or ENS name');
  }

  const trimmed = input.trim();

  // Already a hex address — return as-is
  if (isAddress(trimmed)) {
    return trimmed as `0x${string}`;
  }

  // Treat as ENS name
  try {
    const address = await ensClient.getEnsAddress({ name: normalize(trimmed) });
    if (!address) {
      throw new Error(`ENS name "${trimmed}" could not be resolved`);
    }
    return address;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to resolve "${trimmed}": ${msg}`);
  }
}

/**
 * Resolves an address/ENS name, returns null instead of throwing.
 * Useful for optional fields.
 */
export async function tryResolveAddress(input: string | undefined): Promise<`0x${string}` | null> {
  if (!input) return null;
  try {
    return await resolveAddress(input);
  } catch {
    return null;
  }
}
