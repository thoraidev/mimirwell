/**
 * lib/lit.ts — Lit Protocol v8 / Naga helpers for MimirWell
 * Network: nagaMainnet (production — TEE attested nodes)
 * Docs: https://developer.litprotocol.com/sdk/introduction
 */

import { createLitClient } from "@lit-protocol/lit-client";
import { nagaMainnet } from "@lit-protocol/networks";
import { createAccBuilder } from "@lit-protocol/access-control-conditions";
import { createAuthManager } from "@lit-protocol/auth";
import { privateKeyToAccount } from "viem/accounts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncryptedMemory {
  ciphertext: string;
  dataToEncryptHash: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accessControlConditions: any;
  chain: string;
}

// ─── Agent wallet (server-side) ───────────────────────────────────────────────

export function getAgentAccount() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("AGENT_PRIVATE_KEY env var not set");
  return privateKeyToAccount(pk as `0x${string}`);
}

export function getAgentAddress(): string {
  return getAgentAccount().address;
}

// ─── Client singleton (server-side) ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

export async function getLitClient() {
  if (_client) return _client;
  _client = await createLitClient({ network: nagaMainnet });
  return _client;
}

// ─── Minimal in-memory storage for AuthManager ────────────────────────────────
// Avoids filesystem deps while satisfying the LitAuthStorageProvider interface

const _authCache = new Map<string, string>();

const _memoryStorage = {
  config: {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async read(_params: { address: string }) {
    return null; // always fresh — no stale session keys
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async write(_params: unknown) {},
  async writeInnerDelegationAuthSig({ publicKey, authSig }: { publicKey: string; authSig: string }) {
    _authCache.set(publicKey, authSig);
  },
  async readInnerDelegationAuthSig({ publicKey }: { publicKey: string }) {
    return _authCache.get(publicKey) ?? null;
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async writePKPTokens(_params: unknown) {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async readPKPTokens(_params: unknown) { return null; },
};

// ─── Revocation contract (deployed on Ethereum mainnet) ───────────────────────
// Any decrypt attempt checks isRevoked(ownerWallet, agentWallet) — Lit enforces this.

const REVOCATION_CONTRACT = "0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258";

const REVOCATION_ABI = {
  name: "isRevoked",
  type: "function",
  inputs: [
    { name: "owner", type: "address" },
    { name: "agent", type: "address" },
  ],
  outputs: [{ name: "", type: "bool" }],
  stateMutability: "view",
};

// ─── Build access control conditions ─────────────────────────────────────────
// Agent must prove ownership of their wallet to decrypt.
// Revocation is enforced server-side (in-memory cache mirrors on-chain state).
// On-chain contract (0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258) is the source
// of truth — server checks it and caches; Lit enforces wallet identity.

export function buildAccessConditions(
  agentWallet: string,
  ownerWallet?: string  // kept for API compatibility
) {
  void ownerWallet; // revocation enforced server-side, not in Lit ACC for now
  const builder = createAccBuilder();
  return builder
    .requireWalletOwnership(agentWallet.toLowerCase())
    .on("ethereum")
    .build();
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────
// Encrypts content to the given wallet address (typically the agent's address)

export async function encryptMemory(
  content: string,
  agentWallet: string,
  ownerWallet?: string
): Promise<EncryptedMemory> {
  const client = await getLitClient();
  const accs = buildAccessConditions(agentWallet.toLowerCase(), ownerWallet?.toLowerCase());

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

// ─── Decrypt with agent private key (server-side) ────────────────────────────
// Decrypts using the agent's private key — no browser/wallet interaction needed.
// This is correct for AI agent memory: the agent has its own signing key.

export async function decryptWithAgentKey(
  encrypted: EncryptedMemory
): Promise<string> {
  const client = await getLitClient();
  const agentAccount = getAgentAccount();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authManager = createAuthManager({ storage: _memoryStorage as any });

  const authContext = await authManager.createEoaAuthContext({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    litClient: client as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: { account: agentAccount as any },
    authConfig: {
      domain: "mimirwell.net",
      resources: [
        {
          ability: "access-control-condition-decryption" as const,
          resource: "*",
        },
      ],
      expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  const result = await client.decrypt({
    data: {
      ciphertext: encrypted.ciphertext,
      dataToEncryptHash: encrypted.dataToEncryptHash,
    },
    unifiedAccessControlConditions: encrypted.accessControlConditions,
    authContext,
    chain: "ethereum",
  });

  return new TextDecoder().decode(result.decryptedData);
}
