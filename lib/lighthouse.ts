/**
 * lib/lighthouse.ts — Filecoin/IPFS storage via Lighthouse SDK
 * Stores encrypted blobs from Lit Protocol
 */

import lighthouse from "lighthouse";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  cid: string;
  size: number;
  url: string;
}

export interface StoredBlob {
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: unknown[];
  wallet: string;
  timestamp: number;
}

// ─── Upload encrypted blob ────────────────────────────────────────────────────

export async function uploadToFilecoin(data: StoredBlob): Promise<UploadResult> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) throw new Error("LIGHTHOUSE_API_KEY not configured");

  const json = JSON.stringify(data);
  const buffer = Buffer.from(json, "utf-8");

  // Upload buffer as a file
  const { data: result } = await lighthouse.uploadBuffer(buffer, apiKey);

  const cid = result?.Hash;
  if (!cid) throw new Error("Lighthouse upload failed — no CID returned");

  return {
    cid,
    size: result?.Size ?? buffer.length,
    url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
  };
}

// ─── Fetch encrypted blob from Filecoin ───────────────────────────────────────

export async function fetchFromFilecoin(cid: string): Promise<StoredBlob> {
  // Try multiple gateways for reliability
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

// ─── List uploads for a wallet (via Lighthouse API) ───────────────────────────

export async function listUploads(walletAddress: string): Promise<string[]> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) throw new Error("LIGHTHOUSE_API_KEY not configured");

  try {
    const { data } = await lighthouse.getUploads(apiKey, walletAddress, 1);
    return (data?.fileList ?? []).map((f: { cid: string }) => f.cid);
  } catch {
    return [];
  }
}
