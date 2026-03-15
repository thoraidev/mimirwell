/**
 * lib/lighthouse.ts — Filecoin storage via Lighthouse Web3 SDK
 * https://www.lighthouse.storage/
 */

import lighthouse from "@lighthouse-web3/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  cid: string;
  size: number;
  url: string;
}

export interface StoredBlob {
  /** ZK format (v1): base64 AES-256-GCM encrypted content */
  encryptedBlob?: string;
  /** Schema version — "zk-v1" for zero-knowledge format */
  version?: string;
  /** Human principal who stored this memory (revocation authority) */
  ownerWallet?: string;
  /** Agent wallet associated with this memory (revocation target) */
  agentWallet?: string;
  timestamp: number;

  // ─── Legacy Lit fields (kept for type-safety on old fetched blobs) ─────────
  /** @deprecated Lit Protocol ciphertext — unrecoverable after network migration */
  ciphertext?: string;
  /** @deprecated Lit dataToEncryptHash */
  dataToEncryptHash?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  /** @deprecated Lit access control conditions */
  accessControlConditions?: any;
  /** @deprecated Legacy owner wallet field */
  wallet?: string;
}

// ─── Upload encrypted blob ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function uploadToFilecoin(data: StoredBlob | Record<string, any>): Promise<UploadResult> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) throw new Error("LIGHTHOUSE_API_KEY not configured");

  const json = JSON.stringify(data);

  // Upload text/JSON buffer
  const result = await lighthouse.uploadText(json, apiKey);

  const cid = result?.data?.Hash;
  if (!cid) throw new Error("Lighthouse upload failed — no CID returned");

  return {
    cid,
    size: result?.data?.Size ?? json.length,
    url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
  };
}

// ─── Fetch encrypted blob from Filecoin ───────────────────────────────────────

export async function fetchFromFilecoin(cid: string): Promise<StoredBlob> {
  const gateways = [
    `https://gateway.lighthouse.storage/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
  ];

  let lastError: Error | null = null;

  for (const url of gateways) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();
      return data as StoredBlob;
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw lastError ?? new Error(`Failed to fetch CID ${cid} from all gateways`);
}

// ─── List uploads for a wallet ────────────────────────────────────────────────

export async function listUploads(walletAddress: string): Promise<string[]> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) throw new Error("LIGHTHOUSE_API_KEY not configured");

  try {
    const result = await lighthouse.getUploads(apiKey);
    const files = result?.data?.fileList ?? [];
    // Filter by wallet if metadata available
    return files
      .filter((f: { publicKey?: string; cid: string }) =>
        !walletAddress || f.publicKey?.toLowerCase() === walletAddress.toLowerCase()
      )
      .map((f: { cid: string }) => f.cid);
  } catch {
    return [];
  }
}
