/**
 * lib/lit.ts — Lit Protocol v8 / Naga helpers for MimirWell
 * Network: nagaDev (free, no payment required, perfect for dev/demo)
 * Docs: https://developer.litprotocol.com/sdk/introduction
 */

import { createLitClient } from "@lit-protocol/lit-client";
import { nagaDev } from "@lit-protocol/networks";
import { createAccBuilder } from "@lit-protocol/access-control-conditions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncryptedMemory {
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: ReturnType<ReturnType<typeof createAccBuilder>["build"]>;
  chain: string;
}

// ─── Client singleton (server-side) ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

export async function getLitClient() {
  if (_client) return _client;
  _client = await createLitClient({ network: nagaDev });
  return _client;
}

// ─── Build wallet-ownership access control conditions ─────────────────────────

export function buildAccessConditions(walletAddress: string) {
  const builder = createAccBuilder();
  return builder
    .requireWalletOwnership(walletAddress)
    .on("ethereum")
    .build();
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────
// Note: Encryption does NOT require authContext — anyone can encrypt

export async function encryptMemory(
  content: string,
  walletAddress: string
): Promise<EncryptedMemory> {
  const client = await getLitClient();
  const accs = buildAccessConditions(walletAddress.toLowerCase());

  const encrypted = await client.encrypt({
    dataToEncrypt: content,
    unifiedAccessControlConditions: accs,
    chain: "ethereum",
  });

  return {
    ciphertext: encrypted.ciphertext,
    dataToEncryptHash: encrypted.dataToEncryptHash,
    accessControlConditions: accs,
    chain: "ethereum",
  };
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────
// Note: Decryption REQUIRES authContext — wallet must sign to prove ownership

export async function decryptMemory(
  encrypted: EncryptedMemory,
  // authContext is the result of authManager.createEoaAuthContext()
  // passed from the client after wallet signing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authContext: any
): Promise<string> {
  const client = await getLitClient();

  const result = await client.decrypt({
    data: {
      ciphertext: encrypted.ciphertext,
      dataToEncryptHash: encrypted.dataToEncryptHash,
    },
    unifiedAccessControlConditions: encrypted.accessControlConditions,
    authContext,
    chain: "ethereum",
  });

  // result.decryptedData is a Uint8Array — convert to string
  return new TextDecoder().decode(result.decryptedData);
}
