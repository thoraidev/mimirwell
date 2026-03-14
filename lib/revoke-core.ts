/**
 * lib/revoke-core.ts
 *
 * Core revocation logic shared by /api/revoke and /api/revoke-owner.
 * Extracted so API routes can call it directly without internal HTTP fetches.
 */

import { createPublicClient, http, encodeFunctionData } from "viem";
import { mainnet } from "viem/chains";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const siwaKeystore = require("@buildersgarden/siwa/keystore") as {
  getAddress: (config: { proxyUrl: string; proxySecret: string }) => Promise<string | null>;
  signTransaction: (
    tx: Record<string, unknown>,
    config: { proxyUrl: string; proxySecret: string }
  ) => Promise<{ signedTx: string }>;
};
import { resolveAddress } from "@/lib/ens";
import { logRevoke, logReinstate } from "@/lib/activity-log";

export const REVOCATION_CONTRACT = "0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258" as const;

export const REVOCATION_ABI = [
  {
    name: "revoke",
    type: "function",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "reinstate",
    type: "function",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "isRevoked",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "agent", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

// In-memory cache — mirrors on-chain state within the process
const _revokedCache = new Set<string>();

export function isRevokedCached(ownerWallet: string, agentWallet: string): boolean {
  return _revokedCache.has(`${ownerWallet.toLowerCase()}:${agentWallet.toLowerCase()}`);
}

export function removeCachedRevoke(ownerWallet: string, agentWallet: string): void {
  _revokedCache.delete(`${ownerWallet.toLowerCase()}:${agentWallet.toLowerCase()}`);
}

export interface RevokeResult {
  status: "revoked";
  agentWallet: string;
  ownerWallet: string;
  txHash: `0x${string}`;
  blockNumber: string;
  etherscan: string;
  revokedAt: string;
}

export async function executeRevoke(rawAgent: string, rawOwner: string): Promise<RevokeResult> {
  const agentAddress = await resolveAddress(rawAgent);
  const ownerAddress = await resolveAddress(rawOwner);

  const proxyUrl = process.env.KEYRING_PROXY_URL;
  const proxySecret = process.env.KEYRING_PROXY_SECRET;
  if (!proxyUrl || !proxySecret) throw new Error("Keyring proxy not configured");

  const keystoreConfig = { proxyUrl, proxySecret };
  const signerAddressRaw = await siwaKeystore.getAddress(keystoreConfig);
  if (!signerAddressRaw) throw new Error("Keyring proxy returned no address");
  const signerAddress = signerAddressRaw as `0x${string}`;

  if (signerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error(`Signer (${signerAddress}) does not match ownerWallet (${ownerAddress})`);
  }

  const client = createPublicClient({
    chain: mainnet,
    transport: http("https://ethereum-rpc.publicnode.com"),
  });

  const data = encodeFunctionData({
    abi: REVOCATION_ABI,
    functionName: "revoke",
    args: [agentAddress],
  });

  const nonce = await client.getTransactionCount({ address: signerAddress });
  const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();
  const gas = await client.estimateGas({
    account: signerAddress,
    to: REVOCATION_CONTRACT,
    data,
  });

  const tx = {
    to: REVOCATION_CONTRACT as `0x${string}`,
    data: data as `0x${string}`,
    nonce,
    chainId: mainnet.id,
    type: 2 as const,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gas: (gas * 130n) / 100n,
  };

  const { signedTx } = await siwaKeystore.signTransaction(tx as Record<string, unknown>, keystoreConfig);
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx as `0x${string}` });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });

  _revokedCache.add(`${ownerAddress.toLowerCase()}:${agentAddress.toLowerCase()}`);
  logRevoke({ ownerWallet: ownerAddress, agentWallet: agentAddress, txHash });

  console.log(`[revoke-core] Agent ${agentAddress} revoked by ${ownerAddress} | tx ${txHash}`);

  return {
    status: "revoked",
    agentWallet: agentAddress.toLowerCase(),
    ownerWallet: ownerAddress.toLowerCase(),
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    etherscan: `https://etherscan.io/tx/${txHash}`,
    revokedAt: new Date().toISOString(),
  };
}

// ─── Reinstate ────────────────────────────────────────────────────────────────

export interface ReinstateResult {
  status: "reinstated";
  agentWallet: string;
  ownerWallet: string;
  txHash: `0x${string}`;
  blockNumber: string;
  etherscan: string;
  reinstatedAt: string;
}

export async function executeReinstate(rawAgent: string, rawOwner: string): Promise<ReinstateResult> {
  const agentAddress = await resolveAddress(rawAgent);
  const ownerAddress = await resolveAddress(rawOwner);

  const proxyUrl = process.env.KEYRING_PROXY_URL;
  const proxySecret = process.env.KEYRING_PROXY_SECRET;
  if (!proxyUrl || !proxySecret) throw new Error("Keyring proxy not configured");

  const keystoreConfig = { proxyUrl, proxySecret };
  const signerAddressRaw = await siwaKeystore.getAddress(keystoreConfig);
  if (!signerAddressRaw) throw new Error("Keyring proxy returned no address");
  const signerAddress = signerAddressRaw as `0x${string}`;

  if (signerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error(`Signer (${signerAddress}) does not match ownerWallet (${ownerAddress})`);
  }

  const client = createPublicClient({
    chain: mainnet,
    transport: http("https://ethereum-rpc.publicnode.com"),
  });

  const data = encodeFunctionData({
    abi: REVOCATION_ABI,
    functionName: "reinstate",
    args: [agentAddress],
  });

  const nonce = await client.getTransactionCount({ address: signerAddress });
  const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();
  const gas = await client.estimateGas({
    account: signerAddress,
    to: REVOCATION_CONTRACT,
    data,
  });

  const tx = {
    to: REVOCATION_CONTRACT as `0x${string}`,
    data: data as `0x${string}`,
    nonce,
    chainId: mainnet.id,
    type: 2 as const,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gas: (gas * 130n) / 100n,
  };

  const { signedTx } = await siwaKeystore.signTransaction(tx as Record<string, unknown>, keystoreConfig);
  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx as `0x${string}` });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });

  // Clear from in-memory cache so subsequent recalls go through on-chain check
  removeCachedRevoke(ownerAddress, agentAddress);
  logReinstate({ ownerWallet: ownerAddress, agentWallet: agentAddress, txHash });

  console.log(`[revoke-core] Agent ${agentAddress} reinstated by ${ownerAddress} | tx ${txHash}`);

  return {
    status: "reinstated",
    agentWallet: agentAddress.toLowerCase(),
    ownerWallet: ownerAddress.toLowerCase(),
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    etherscan: `https://etherscan.io/tx/${txHash}`,
    reinstatedAt: new Date().toISOString(),
  };
}
