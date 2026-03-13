/**
 * lib/lit.ts — Lit Protocol v7 / Naga helpers for MimirWell
 * Network: naga-dev (free, no payment required)
 */

import { LitNodeClient, encryptString, decryptToString } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK } from "@lit-protocol/constants";
import type { AccsDefaultParams } from "@lit-protocol/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncryptedMemory {
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: AccsDefaultParams[];
}

// ─── Client singleton (server-side) ───────────────────────────────────────────

let _client: LitNodeClient | null = null;

export async function getLitClient(): Promise<LitNodeClient> {
  if (_client && _client.ready) return _client;

  _client = new LitNodeClient({
    litNetwork: LIT_NETWORK.NagaDev,
    debug: false,
  });

  await _client.connect();
  return _client;
}

// ─── Build wallet-ownership access control conditions ─────────────────────────

export function buildAccessConditions(walletAddress: string): AccsDefaultParams[] {
  return [
    {
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: walletAddress.toLowerCase(),
      },
    },
  ];
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────

export async function encryptMemory(
  content: string,
  walletAddress: string
): Promise<EncryptedMemory> {
  const client = await getLitClient();
  const accessControlConditions = buildAccessConditions(walletAddress);

  const { ciphertext, dataToEncryptHash } = await encryptString(
    {
      accessControlConditions,
      dataToEncrypt: content,
    },
    client
  );

  return {
    ciphertext,
    dataToEncryptHash,
    accessControlConditions,
  };
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

export async function decryptMemory(
  encrypted: EncryptedMemory,
  authSig: Record<string, unknown>
): Promise<string> {
  const client = await getLitClient();

  const decrypted = await decryptToString(
    {
      accessControlConditions: encrypted.accessControlConditions,
      ciphertext: encrypted.ciphertext,
      dataToEncryptHash: encrypted.dataToEncryptHash,
      authSig,
      chain: "ethereum",
    },
    client
  );

  return decrypted;
}
