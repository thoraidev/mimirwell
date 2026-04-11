/**
 * lib/arweave.ts — Permanent storage via Arweave Turbo SDK
 *
 * Replaces lib/lighthouse.ts (Filecoin/Lighthouse).
 *
 * Free tier: uploads < 100 KiB (102,400 bytes) are stored permanently at no cost.
 * Agents should gzip plaintext before AES-256-GCM encryption (zk-v2) to keep
 * blobs well under this limit even for large memory files.
 *
 * Requires env:
 *   TURBO_WALLET_PRIVATE_KEY — EVM private key (hex, with or without 0x prefix)
 *
 * Tags written per upload (public metadata — content remains AES-encrypted):
 *   Content-Type, App-Name, Version, Agent-Wallet, Owner-Wallet, Timestamp
 *
 * GraphQL recovery: any new server instance can reconstruct the full txId index
 * by querying Arweave's built-in GraphQL endpoint with App-Name + Agent-Wallet.
 * The network IS the index — no manifest CID or external state required.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TurboFactory } = require("@ardrive/turbo-sdk") as {
  TurboFactory: {
    authenticated: (opts: { privateKey: string; token: string }) => {
      uploadFile: (opts: {
        fileStreamFactory: () => Buffer;
        fileSizeFactory: () => number;
        signal?: AbortSignal;
        dataItemOpts?: { tags?: { name: string; value: string }[] };
      }) => Promise<{ id: string; winc?: string }>;
    };
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum upload size in bytes — stay safely under Turbo's 100 KiB free threshold */
export const MAX_UPLOAD_BYTES = 90_000;

/** Primary Arweave gateway */
const GATEWAY = "https://arweave.net";

/** Arweave GraphQL endpoint */
const ARWEAVE_GRAPHQL = "https://arweave.net/graphql";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  txId: string;
  size: number;
  url: string;
}

export interface StoredBlob {
  /** ZK format: base64 AES-256-GCM encrypted content */
  encryptedBlob?: string;
  /**
   * Schema version:
   *   "zk-v1" — encrypted only (Filecoin era, no compression)
   *   "zk-v2" — gzip compressed, then encrypted (Arweave era, free tier)
   */
  version?: string;
  /** Human principal who stored this memory (revocation authority) */
  ownerWallet?: string;
  /** Agent wallet associated with this memory (revocation target) */
  agentWallet?: string;
  timestamp: number;

  // ─── Legacy Filecoin/Lit fields — kept for type-safety on old fetched blobs ─
  /** @deprecated Lit Protocol ciphertext — unrecoverable after network migration */
  ciphertext?: string;
  /** @deprecated Lit dataToEncryptHash */
  dataToEncryptHash?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  /** @deprecated Lit access control conditions */
  accessControlConditions?: any;
  /** @deprecated Legacy owner wallet field (Filecoin era) */
  wallet?: string;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function uploadToArweave(data: StoredBlob | Record<string, any>): Promise<UploadResult> {
  const privateKey = process.env.TURBO_WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error("TURBO_WALLET_PRIVATE_KEY not configured");

  const json = JSON.stringify(data);
  const buffer = Buffer.from(json, "utf8");

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Blob too large: ${buffer.length} bytes (max ${MAX_UPLOAD_BYTES}). ` +
      `Agent must use compressAndEncryptMemory() (zk-v2) to stay under the free threshold.`
    );
  }

  const turbo = TurboFactory.authenticated({
    privateKey,
    token: "base-usdc",
  });

  const d = data as Record<string, unknown>;
  const result = await turbo.uploadFile({
    fileStreamFactory: () => buffer,
    fileSizeFactory: () => buffer.length,
    signal: AbortSignal.timeout(60_000),
    dataItemOpts: {
      tags: [
        { name: "Content-Type",  value: "application/json" },
        { name: "App-Name",      value: "MimirWell" },
        { name: "Version",       value: String(d.version ?? "zk-v2") },
        { name: "Agent-Wallet",  value: String(d.agentWallet ?? "") },
        // Owner-Wallet tag only written when oversight is enabled (ownerWallet provided)
        ...(d.ownerWallet ? [{ name: "Owner-Wallet", value: String(d.ownerWallet) }] : []),
        { name: "Timestamp",     value: String(d.timestamp ?? Date.now()) },
      ],
    },
  });

  const txId = result.id;
  if (!txId) throw new Error("Arweave upload failed — no transaction ID returned");

  return {
    txId,
    size: buffer.length,
    url: `${GATEWAY}/${txId}`,
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchFromArweave(txId: string): Promise<StoredBlob> {
  const gateways = [
    `${GATEWAY}/${txId}`,
    `https://ar-io.net/${txId}`,
    `https://permagate.io/${txId}`,
  ];

  let lastError: Error | null = null;

  for (const url of gateways) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const blob = await res.json();
      return blob as StoredBlob;
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError ?? new Error(`Failed to fetch txId ${txId} from all Arweave gateways`);
}

// ─── GraphQL recovery ─────────────────────────────────────────────────────────
//
// Queries Arweave's built-in tag index to reconstruct the full txId list for any agent.
// This eliminates the need for a manifest CID or external state — the Arweave
// network is the index. Call this on a fresh server instance to rebuild the registry.
//
// Note: newly uploaded transactions may not appear in GraphQL immediately (< ~2 min).
// The local registry is authoritative for recent writes; GraphQL is the recovery path.

export interface ArweaveTxMeta {
  txId: string;
  timestamp: number;
  agentWallet: string;
  ownerWallet: string;
  version: string;
}

export async function queryMemoriesByAgent(
  agentWallet: string,
  ownerWallet?: string
): Promise<ArweaveTxMeta[]> {
  // Build GraphQL tag filters
  const filters = [
    `{ name: "App-Name", values: ["MimirWell"] }`,
    `{ name: "Agent-Wallet", values: ${JSON.stringify([agentWallet])} }`,
    ...(ownerWallet ? [`{ name: "Owner-Wallet", values: ${JSON.stringify([ownerWallet])} }`] : []),
  ];

  const query = `{
    transactions(
      tags: [${filters.join(", ")}]
      first: 100
      sort: HEIGHT_DESC
    ) {
      edges {
        node {
          id
          block { timestamp }
          tags { name value }
        }
      }
    }
  }`;

  const res = await fetch(ARWEAVE_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`Arweave GraphQL query failed: ${res.status}`);

  const { data } = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data?.transactions?.edges ?? []).map((edge: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags: Record<string, string> = Object.fromEntries(edge.node.tags.map((t: any) => [t.name, t.value]));
    const blockTs = edge.node.block?.timestamp;
    return {
      txId: edge.node.id as string,
      // Arweave block timestamps are in seconds; convert to ms
      timestamp: blockTs ? blockTs * 1000 : parseInt(tags["Timestamp"] ?? "0"),
      agentWallet: tags["Agent-Wallet"] ?? agentWallet,
      ownerWallet: tags["Owner-Wallet"] ?? ownerWallet ?? "",
      version: tags["Version"] ?? "zk-v2",
    };
  });
}
