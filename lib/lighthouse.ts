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
  ciphertext: string;
  dataToEncryptHash: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accessControlConditions: any;
  /** Legacy: owner wallet (pre-agent-key model) */
  wallet?: string;
  /** Human principal who stored this memory */
  ownerWallet?: string;
  /** Agent wallet the memory is encrypted to */
  agentWallet?: string;
  timestamp: number;
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
