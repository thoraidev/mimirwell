/**
 * lib/useTxReceipt.ts — Reliable transaction receipt polling
 *
 * Bypasses wagmi's block-watcher transport entirely.
 * Polls MetaMask's injected window.ethereum provider first (it already has
 * the receipt — MetaMask detected confirmation before we even asked).
 * Falls back to a direct JSON-RPC call to publicnode.com.
 *
 * No viem internals, no block subscriptions, no transport fallback chains.
 * Works as long as MetaMask is connected or publicnode.com is reachable.
 */

import { useState, useEffect, useRef } from "react";

type TxStatus = "idle" | "polling" | "confirmed" | "failed";

const FALLBACK_RPC = "https://ethereum-rpc.publicnode.com";
const POLL_INTERVAL_MS = 3000;

export function useTxReceipt(txHash: string | undefined): {
  confirmed: boolean;
  failed: boolean;
  polling: boolean;
} {
  const [status, setStatus] = useState<TxStatus>("idle");
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!txHash) {
      setStatus("idle");
      return;
    }

    cancelRef.current = false;
    setStatus("polling");

    async function checkReceipt(): Promise<void> {
      if (cancelRef.current) return;

      // ── Primary: MetaMask's own provider ─────────────────────────────────
      try {
        const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum;
        if (eth?.request) {
          const receipt = await eth.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          }) as { status?: string } | null;

          if (receipt && !cancelRef.current) {
            setStatus(receipt.status === "0x1" ? "confirmed" : "failed");
            return;
          }
        }
      } catch {
        // MetaMask unavailable or error — fall through to RPC
      }

      // ── Fallback: publicnode.com direct JSON-RPC ──────────────────────────
      try {
        const res = await fetch(FALLBACK_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionReceipt",
            params: [txHash],
          }),
        });
        const { result } = (await res.json()) as { result?: { status?: string } | null };
        if (result && !cancelRef.current) {
          setStatus(result.status === "0x1" ? "confirmed" : "failed");
          return;
        }
      } catch {
        // RPC error — retry on next interval
      }

      // ── Not yet confirmed — retry ─────────────────────────────────────────
      if (!cancelRef.current) {
        setTimeout(checkReceipt, POLL_INTERVAL_MS);
      }
    }

    checkReceipt();

    return () => {
      cancelRef.current = true;
    };
  }, [txHash]);

  return {
    confirmed: status === "confirmed",
    failed:    status === "failed",
    polling:   status === "polling",
  };
}
