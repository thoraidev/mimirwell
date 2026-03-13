/**
 * POST /api/revoke
 * Revokes an agent wallet's decrypt rights — on-chain via MimirWellRevocation contract.
 *
 * Body: { agentWallet: string, ownerWallet: string }
 *   Both fields accept hex addresses or ENS names.
 *
 * Returns: { status: "revoked", txHash: string }
 *
 * On-chain: calls MimirWellRevocation.revoke(agentWallet) from ownerWallet.
 * Lit Protocol checks isRevoked() at every decrypt — no server involvement at decrypt time.
 */

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { mainnet } from "viem/chains";
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";
import { resolveAddress } from "@/lib/ens";
import { logRevoke } from "@/lib/activity-log";

// ─── Contract ─────────────────────────────────────────────────────────────────

const REVOCATION_CONTRACT = "0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258" as const;

const REVOCATION_ABI = [
  {
    name: "revoke",
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

// ─── In-memory cache (mirrors on-chain state, survives within process) ────────
const _revokedCache = new Set<string>();

export function isRevokedCached(ownerWallet: string, agentWallet: string): boolean {
  return _revokedCache.has(`${ownerWallet.toLowerCase()}:${agentWallet.toLowerCase()}`);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentWallet: rawAgent, ownerWallet: rawOwner } = body as {
      agentWallet: string;
      ownerWallet: string;
    };

    if (!rawAgent || typeof rawAgent !== "string") {
      return NextResponse.json({ error: "agentWallet is required" }, { status: 400 });
    }
    if (!rawOwner || typeof rawOwner !== "string") {
      return NextResponse.json({ error: "ownerWallet is required" }, { status: 400 });
    }

    // Guard: require server API secret to prevent unauthorized revokes
    const apiSecret = process.env.MIMIRWELL_API_SECRET;
    const callerSecret = req.headers.get("x-mimirwell-secret");
    if (apiSecret && callerSecret !== apiSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve ENS names
    const agentAddress = await resolveAddress(rawAgent);
    const ownerAddress = await resolveAddress(rawOwner);

    // Build signer from keyring proxy env vars
    const proxyUrl = process.env.KEYRING_PROXY_URL;
    const proxySecret = process.env.KEYRING_PROXY_SECRET;
    if (!proxyUrl || !proxySecret) {
      return NextResponse.json({ error: "Keyring proxy not configured" }, { status: 500 });
    }

    const signer = createKeyringProxySigner({ proxyUrl, proxySecret });
    const signerAddressRaw = await signer.getAddress();
    if (!signerAddressRaw) {
      return NextResponse.json({ error: "Keyring proxy returned no address" }, { status: 500 });
    }
    const signerAddress = signerAddressRaw as `0x${string}`;

    // Verify the signer IS the owner (security check)
    if (signerAddress.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json(
        { error: `Signer (${signerAddress}) does not match ownerWallet (${ownerAddress})` },
        { status: 403 }
      );
    }

    const client = createPublicClient({
      chain: mainnet,
      transport: http("https://ethereum-rpc.publicnode.com"),
    });

    // Build the revoke() call
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

    const signedTx = await signer.signTransaction(tx);
    const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx as `0x${string}` });

    // Wait for confirmation
    const receipt = await client.waitForTransactionReceipt({ hash: txHash });

    // Update in-memory cache
    _revokedCache.add(`${ownerAddress.toLowerCase()}:${agentAddress.toLowerCase()}`);

    // Log to activity feed
    logRevoke({ ownerWallet: ownerAddress, agentWallet: agentAddress, txHash });

    console.log(`[/api/revoke] Agent ${agentAddress} revoked by ${ownerAddress} | tx ${txHash}`);

    return NextResponse.json({
      status: "revoked",
      agentWallet: agentAddress.toLowerCase(),
      ownerWallet: ownerAddress.toLowerCase(),
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      etherscan: `https://etherscan.io/tx/${txHash}`,
      revokedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/revoke] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, status: "failed" }, { status: 500 });
  }
}

// Legacy export — kept for /api/recall compatibility during transition
export function isRevoked(ownerWallet: string, agentWallet: string): boolean {
  return isRevokedCached(ownerWallet, agentWallet);
}
