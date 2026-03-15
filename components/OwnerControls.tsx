"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { mainnet } from "wagmi/chains";

// ─── Revocation contract ──────────────────────────────────────────────────────

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
    name: "reinstate",
    type: "function",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Pre-filled demo agent — thorai.eth
const DEMO_AGENT = "0x8884AE2D5A381833565A8AAe6BD38bc3E4520412";

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerControls() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== mainnet.id;

  const [agentAddress, setAgentAddress] = useState(DEMO_AGENT);
  const [agentEns, setAgentEns] = useState<string | null>("thorai.eth");
  const [ownerEns, setOwnerEns] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // ── Wagmi hooks — own instances, independent of DemoPanel ─────────────────
  const {
    writeContract: writeRevoke,
    data: revokeTxHash,
    isPending: revokeIsPending,
    error: revokeError,
  } = useWriteContract();

  const { isLoading: revokeConfirming, isSuccess: revokeConfirmed } =
    useWaitForTransactionReceipt({ hash: revokeTxHash, pollingInterval: 4000, timeout: 0 });

  const {
    writeContract: writeReinstate,
    data: reinstateTxHash,
    isPending: reinstateIsPending,
    error: reinstateError,
  } = useWriteContract();

  const { isLoading: reinstateConfirming, isSuccess: reinstateConfirmed } =
    useWaitForTransactionReceipt({ hash: reinstateTxHash, pollingInterval: 4000, timeout: 0 });

  // ── ENS: resolve connected wallet (owner) ─────────────────────────────────
  useEffect(() => {
    if (!address) return;
    setOwnerEns(null);
    fetch(`/api/ens-lookup?address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d) => setOwnerEns(d.name ?? null))
      .catch(() => {});
  }, [address]);

  // ── ENS: reverse-lookup agent address as user types ───────────────────────
  useEffect(() => {
    if (agentAddress.toLowerCase() === DEMO_AGENT.toLowerCase()) {
      setAgentEns("thorai.eth");
      return;
    }
    if (!agentAddress.startsWith("0x") || agentAddress.length !== 42) {
      setAgentEns(null);
      return;
    }
    setAgentEns(null);
    fetch(`/api/ens-lookup?address=${encodeURIComponent(agentAddress)}`)
      .then((r) => r.json())
      .then((d) => setAgentEns(d.name ?? null))
      .catch(() => {});
  }, [agentAddress]);

  // ── Revoke lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (revokeIsPending) setStatus("Confirm the transaction in MetaMask…");
  }, [revokeIsPending]);

  useEffect(() => {
    if (revokeConfirming) setStatus("Transaction submitted — waiting for mainnet confirmation…");
  }, [revokeConfirming]);

  useEffect(() => {
    if (revokeConfirmed && revokeTxHash)
      setStatus(
        `✓ Access revoked on-chain — tx: ${revokeTxHash.slice(0, 14)}… · https://etherscan.io/tx/${revokeTxHash}`
      );
  }, [revokeConfirmed, revokeTxHash]);

  useEffect(() => {
    if (revokeError)
      setStatus(`✗ ${revokeError.message?.split("\n")[0] ?? "Transaction failed"}`);
  }, [revokeError]);

  // ── Reinstate lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (reinstateIsPending) setStatus("Confirm the reinstatement in MetaMask…");
  }, [reinstateIsPending]);

  useEffect(() => {
    if (reinstateConfirming) setStatus("Transaction submitted — waiting for mainnet confirmation…");
  }, [reinstateConfirming]);

  useEffect(() => {
    if (reinstateConfirmed && reinstateTxHash)
      setStatus(
        `✓ Access reinstated on-chain — tx: ${reinstateTxHash.slice(0, 14)}… · https://etherscan.io/tx/${reinstateTxHash}`
      );
  }, [reinstateConfirmed, reinstateTxHash]);

  useEffect(() => {
    if (reinstateError)
      setStatus(`✗ ${reinstateError.message?.split("\n")[0] ?? "Transaction failed"}`);
  }, [reinstateError]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isValidAddress = agentAddress.startsWith("0x") && agentAddress.length === 42;
  const isBusy = revokeIsPending || revokeConfirming || reinstateIsPending || reinstateConfirming;
  const isDemo = agentAddress.toLowerCase() === DEMO_AGENT.toLowerCase();

  const handleRevoke = () => {
    if (!isValidAddress || isBusy) return;
    if (wrongNetwork) { switchChain?.({ chainId: mainnet.id }); return; }
    writeRevoke({
      address: REVOCATION_CONTRACT,
      abi: REVOCATION_ABI,
      functionName: "revoke",
      args: [agentAddress as `0x${string}`],
    });
  };

  const handleReinstate = () => {
    if (!isValidAddress || isBusy) return;
    if (wrongNetwork) { switchChain?.({ chainId: mainnet.id }); return; }
    writeReinstate({
      address: REVOCATION_CONTRACT,
      abi: REVOCATION_ABI,
      functionName: "reinstate",
      args: [agentAddress as `0x${string}`],
    });
  };

  const statusIsSuccess = status?.startsWith("✓");
  const statusIsError   = status?.startsWith("✗");

  return (
    <section
      id="owner-controls"
      className="px-6 pb-20 max-w-4xl mx-auto scroll-mt-24"
    >
      {/* Section header */}
      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest mb-4"
          style={{
            borderColor: "rgba(245,158,11,0.35)",
            color: "#f59e0b",
            background: "rgba(245,158,11,0.08)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "#f59e0b" }}
          />
          OWNER CONTROLS
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">The Kill Switch</h2>
        <p className="text-gray-500 text-sm max-w-xl mx-auto">
          Connect as the human owner. Enter any agent&apos;s wallet address.
          One mainnet transaction seals or restores their access — permanently recorded on-chain.
        </p>
      </div>

      <div
        className="rounded-xl border p-6"
        style={{
          borderColor: "rgba(245,158,11,0.2)",
          background: "rgba(245,158,11,0.025)",
        }}
      >
        {/* ── Not connected ─────────────────────────────────────────────── */}
        {!isConnected && (
          <div className="text-center py-8 space-y-3">
            <div className="text-3xl" style={{ color: "rgba(245,158,11,0.25)" }}>ᚨ</div>
            <p className="text-sm text-gray-500">
              Connect your wallet via the button in the top-right corner.
            </p>
            <p className="text-xs text-gray-600">
              You&apos;ll be the <span style={{ color: "#f59e0b" }}>human owner</span> — the wallet that holds the kill switch.
            </p>
          </div>
        )}

        {/* ── Connected ─────────────────────────────────────────────────── */}
        {isConnected && (
          <div className="space-y-5">

            {/* Owner identity row */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-lg border"
              style={{
                borderColor: "rgba(245,158,11,0.15)",
                background: "rgba(245,158,11,0.04)",
              }}
            >
              <span className="text-lg shrink-0" style={{ color: "#f59e0b" }}>ᚨ</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 mb-0.5">Human owner · connected as</div>
                <div className="text-sm font-mono font-bold" style={{ color: "#f59e0b" }}>
                  {ownerEns ?? `${address!.slice(0, 6)}…${address!.slice(-4)}`}
                </div>
                {ownerEns && (
                  <div className="text-xs font-mono text-gray-600 mt-0.5">
                    {address!.slice(0, 6)}…{address!.slice(-4)}
                  </div>
                )}
              </div>
              {wrongNetwork && (
                <button
                  onClick={() => switchChain?.({ chainId: mainnet.id })}
                  className="shrink-0 text-xs px-3 py-1.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  Switch to Mainnet
                </button>
              )}
              {!wrongNetwork && (
                <span
                  className="shrink-0 text-xs px-2 py-1 rounded border font-mono"
                  style={{ borderColor: "rgba(20,184,166,0.3)", color: "#14b8a6" }}
                >
                  Mainnet ✓
                </span>
              )}
            </div>

            {/* Agent address input */}
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-widest">
                Agent address to control
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={agentAddress}
                  onChange={(e) => setAgentAddress(e.target.value.trim())}
                  className="w-full px-4 py-3 rounded-lg border bg-transparent font-mono text-sm text-white focus:outline-none transition-colors pr-28"
                  style={{
                    borderColor: isValidAddress
                      ? "rgba(245,158,11,0.35)"
                      : "rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.3)",
                  }}
                  placeholder="0x… agent wallet address"
                  spellCheck={false}
                />
                {agentEns && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono pointer-events-none"
                    style={{ color: "#f59e0b" }}
                  >
                    {agentEns}
                  </span>
                )}
              </div>
              {isDemo && (
                <p className="mt-1.5 text-xs text-gray-600">
                  ↑ Pre-filled: thorai.eth — the MimirWell demo agent (ThorAI)
                </p>
              )}
              {!isValidAddress && agentAddress.length > 0 && (
                <p className="mt-1.5 text-xs" style={{ color: "rgba(239,68,68,0.7)" }}>
                  Enter a valid wallet address (0x… 42 characters)
                </p>
              )}
            </div>

            {/* Revoke / Reinstate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleRevoke}
                disabled={!isValidAddress || isBusy || wrongNetwork}
                className="px-4 py-3 rounded-lg border text-sm font-bold tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                style={{
                  borderColor: "rgba(245,158,11,0.45)",
                  color: "#f59e0b",
                  background: "rgba(245,158,11,0.08)",
                }}
              >
                {revokeIsPending
                  ? "Waiting for MetaMask…"
                  : revokeConfirming
                  ? "Confirming on-chain…"
                  : "ᛉ REVOKE ACCESS"}
              </button>

              <button
                onClick={handleReinstate}
                disabled={!isValidAddress || isBusy || wrongNetwork}
                className="px-4 py-3 rounded-lg border text-sm font-bold tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                style={{
                  borderColor: "rgba(167,139,250,0.35)",
                  color: "#a78bfa",
                  background: "rgba(167,139,250,0.05)",
                }}
              >
                {reinstateIsPending
                  ? "Waiting for MetaMask…"
                  : reinstateConfirming
                  ? "Confirming on-chain…"
                  : "ᚱ REINSTATE ACCESS"}
              </button>
            </div>

            {/* Status */}
            {status && (
              <div
                className="text-xs font-mono px-4 py-3 rounded-lg border leading-relaxed"
                style={{
                  borderColor: statusIsSuccess
                    ? "rgba(20,184,166,0.3)"
                    : statusIsError
                    ? "rgba(239,68,68,0.3)"
                    : "rgba(245,158,11,0.2)",
                  color: statusIsSuccess ? "#14b8a6" : statusIsError ? "#ef4444" : "#f59e0b",
                  background: "rgba(0,0,0,0.3)",
                }}
              >
                <span>{status}</span>
                {(revokeTxHash || reinstateTxHash) && (
                  <a
                    href={`https://etherscan.io/tx/${revokeTxHash ?? reinstateTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1.5 opacity-50 hover:opacity-100 transition-opacity"
                  >
                    ↗ etherscan.io/tx/{(revokeTxHash ?? reinstateTxHash)!.slice(0, 20)}…
                  </a>
                )}
              </div>
            )}

            {/* Gas note */}
            <p className="text-xs text-gray-600 text-center">
              ~$0.05 gas · Ethereum mainnet · Revocation on-chain ·{" "}
              <a
                href="https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-400 transition-colors"
              >
                contract ↗
              </a>
            </p>

          </div>
        )}
      </div>
    </section>
  );
}
