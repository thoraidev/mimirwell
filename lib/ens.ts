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

// In-memory cache: address → primary ENS name (null = no primary name)
const _reverseCache = new Map<string, string | null>();

/**
 * Reverse-resolves an Ethereum address to its primary ENS name.
 * Returns null if no primary name is set.
 * Results are cached in-memory for the process lifetime.
 *
 * @example
 * await lookupAddress("0x8884AE2D5A381833565A8AAe6BD38bc3E4520412") // → "thorai.eth"
 * await lookupAddress("0x1234...no-ens")                            // → null
 */
export async function lookupAddress(address: string): Promise<string | null> {
  if (!address || !isAddress(address)) return null;
  const key = address.toLowerCase();
  if (_reverseCache.has(key)) return _reverseCache.get(key)!;
  try {
    const name = await ensClient.getEnsName({ address: address as `0x${string}` });
    _reverseCache.set(key, name ?? null);
    return name ?? null;
  } catch {
    _reverseCache.set(key, null);
    return null;
  }
}

/**
 * Returns a display label for a wallet address:
 * ENS primary name if set, otherwise shortened hex (0x1234…abcd).
 */
export async function displayAddress(address: string): Promise<string> {
  const name = await lookupAddress(address);
  if (name) return name;
  if (address.length >= 10) return `${address.slice(0, 6)}…${address.slice(-4)}`;
  return address;
}
