"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId, useSignMessage } from "wagmi";
import { mainnet } from "wagmi/chains";
import MemoryCard, { type MemoryState } from "./MemoryCard";

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

// ─── Web Crypto helpers ───────────────────────────────────────────────────────
// These run in the browser — no server involvement, no external dependency.
// Key is derived from a wallet signature so only the wallet holder can decrypt.

const DERIVATION_MESSAGE =
  "MimirWell agent key derivation v1 — sign to derive your memory encryption key";

async function deriveKeyFromSignature(hexSignature: string): Promise<CryptoKey> {
  const sigBytes = new Uint8Array(
    hexSignature.replace(/^0x/, "").match(/.{2}/g)!.map((b) => parseInt(b, 16))
  );
  const keyMaterial = await crypto.subtle.importKey("raw", sigBytes, { name: "HKDF" }, false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("mimirwell-v1"),
      info: new TextEncoder().encode("agent-memory-key"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptContent(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Pack: [12-byte IV][ciphertext] → base64
  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(ciphertext), 12);
  return btoa(String.fromCharCode(...packed));
}

async function decryptContent(encryptedBlob: string, key: CryptoKey): Promise<string> {
  const packed = Uint8Array.from(atob(encryptedBlob), (c) => c.charCodeAt(0));
  const iv = packed.slice(0, 12);
  const data = packed.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoryEntry {
  cid: string;
  content?: string;
  agentWallet: string;
  ownerWallet: string;
  state: MemoryState;
  timestamp: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DemoPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();

  // Contract write — revoke
  const { writeContract: writeRevoke, data: revokeTxHash, isPending: revokeIsPending, error: revokeError } = useWriteContract();
  const { isLoading: revokeConfirming, isSuccess: revokeConfirmed } = useWaitForTransactionReceipt({ hash: revokeTxHash, pollingInterval: 4000, timeout: 0 });

  // Contract write — reinstate
  const { writeContract: writeReinstate, data: reinstateTxHash, isPending: reinstateIsPending, error: reinstateError } = useWriteContract();
  const { isLoading: reinstateConfirming, isSuccess: reinstateConfirmed } = useWaitForTransactionReceipt({ hash: reinstateTxHash, pollingInterval: 4000, timeout: 0 });

  // Derived crypto key — persists for the session, never leaves the browser
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const [keyReady, setKeyReady] = useState(false);

  const [ownerEns, setOwnerEns] = useState<string | null>(null);
  const [memoryText, setMemoryText] = useState("");
  const [recallCid, setRecallCid] = useState("");
  const [revokeAgent, setRevokeAgent] = useState("");
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<"remember" | "recall" | null>(null);

  const resolveEns = useCallback(async (addr: string, setter: (n: string | null) => void) => {
    if (!addr) return;
    try {
      const res = await fetch(`/api/ens-lookup?address=${encodeURIComponent(addr)}`);
      const d = await res.json();
      setter(d.name ?? null);
    } catch { setter(null); }
  }, []);

  // Connected wallet is the agent — sync revokeAgent and resolve ENS on address change
  useEffect(() => {
    if (address) {
      setRevokeAgent(address);
      resolveEns(address, setOwnerEns);
    }
  }, [address, resolveEns]);

  // Clear derived key when wallet changes
  useEffect(() => {
    cryptoKeyRef.current = null;
    setKeyReady(false);
  }, [address]);

  // Revoke tx lifecycle
  useEffect(() => { if (revokeIsPending) setStatus("Confirm the transaction in MetaMask…"); }, [revokeIsPending]);
  useEffect(() => { if (revokeConfirming) setStatus("Transaction submitted — waiting for mainnet confirmation…"); }, [revokeConfirming]);
  useEffect(() => {
    if (revokeConfirmed && revokeTxHash) {
      setStatus(`✓ Access revoked on-chain — tx: ${revokeTxHash.slice(0, 14)}… · https://etherscan.io/tx/${revokeTxHash}`);
      // Seal all memory cards — agent access is now blocked
      setMemories(prev => prev.map(m => ({ ...m, state: "sealed" as MemoryState })));
    }
  }, [revokeConfirmed, revokeTxHash]);
  useEffect(() => {
    if (revokeError) setStatus(`✗ ${revokeError.message?.split("\n")[0] ?? "Transaction failed"}`);
  }, [revokeError]);

  // Reinstate tx lifecycle
  useEffect(() => { if (reinstateIsPending) setStatus("Confirm the reinstatement in MetaMask…"); }, [reinstateIsPending]);
  useEffect(() => { if (reinstateConfirming) setStatus("Transaction submitted — waiting for mainnet confirmation…"); }, [reinstateConfirming]);
  useEffect(() => {
    if (reinstateConfirmed && reinstateTxHash) {
      setStatus(`✓ Access reinstated on-chain — tx: ${reinstateTxHash.slice(0, 14)}… · https://etherscan.io/tx/${reinstateTxHash}`);
      // Unseal memory cards — agent access restored
      setMemories(prev => prev.map(m => ({ ...m, state: "recalled" as MemoryState })));
    }
  }, [reinstateConfirmed, reinstateTxHash]);
  useEffect(() => {
    if (reinstateError) setStatus(`✗ ${reinstateError.message?.split("\n")[0] ?? "Transaction failed"}`);
  }, [reinstateError]);

  // ─── Key derivation ───────────────────────────────────────────────────────

  const ensureKey = useCallback(async (): Promise<CryptoKey> => {
    if (cryptoKeyRef.current) return cryptoKeyRef.current;
    setStatus("Sign the message in MetaMask to derive your encryption key — no gas, just a signature…");
    const sig = await signMessageAsync({ message: DERIVATION_MESSAGE });
    const key = await deriveKeyFromSignature(sig);
    cryptoKeyRef.current = key;
    setKeyReady(true);
    return key;
  }, [signMessageAsync]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleRemember = async () => {
    if (!address || !memoryText.trim()) return;
    setLoading("remember");
    try {
      const key = await ensureKey();
      setStatus("Encrypting in your browser — MimirWell will never see this plaintext…");
      const encryptedBlob = await encryptContent(memoryText.trim(), key);

      const res = await fetch("/api/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedBlob,
          ownerWallet: address,
          agentWallet: address,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMemories((prev) => [
        { cid: data.cid, content: memoryText.trim(), agentWallet: address ?? "", ownerWallet: address ?? "", state: "stored", timestamp: Date.now() },
        ...prev,
      ]);
      setMemoryText("");
      setRecallCid(data.cid);
      setStatus(`✓ Encrypted memory stored on Filecoin — CID: ${data.cid.slice(0, 14)}…`);
    } catch (e) {
      setStatus(`✗ Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(null);
    }
  };

  const handleRecall = async () => {
    if (!recallCid.trim()) return;
    setLoading("recall");
    setStatus("Fetching from Filecoin — checking revocation on-chain…");
    try {
      const res = await fetch("/api/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: recallCid.trim() }),
      });
      const data = await res.json();

      if (data.status === "denied") {
        setMemories((prev) => [
          { cid: recallCid.trim(), agentWallet: address ?? "", ownerWallet: address ?? "", state: "sealed", timestamp: Date.now() },
          ...prev,
        ]);
        setStatus("✗ Access denied — revocation confirmed on-chain");
      } else if (res.ok && data.encryptedBlob) {
        setStatus("Revocation clear — decrypting locally with your wallet key…");
        const key = await ensureKey();
        const content = await decryptContent(data.encryptedBlob, key);
        setMemories((prev) => [
          { cid: recallCid.trim(), content, agentWallet: data.agentWallet ?? address ?? "", ownerWallet: address ?? "", state: "recalled", timestamp: Date.now() },
          ...prev,
        ]);
        setRecallCid("");
        setStatus("✓ Decrypted locally — MimirWell never saw the plaintext");
      } else {
        throw new Error(data.error ?? "Unexpected response");
      }
    } catch (e) {
      setStatus(`✗ Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(null);
    }
  };

  const handleRevoke = () => {
    if (!revokeAgent.trim() || !address) return;
    if (chainId !== mainnet.id) { switchChain({ chainId: mainnet.id }); return; }
    setStatus("Opening MetaMask — confirm the revocation transaction…");
    writeRevoke({ address: REVOCATION_CONTRACT, abi: REVOCATION_ABI, functionName: "revoke", args: [revokeAgent.trim() as `0x${string}`] });
  };

  const handleReinstate = () => {
    if (!revokeAgent.trim() || !address) return;
    if (chainId !== mainnet.id) { switchChain({ chainId: mainnet.id }); return; }
    setStatus("Opening MetaMask — confirm the reinstatement transaction…");
    writeReinstate({ address: REVOCATION_CONTRACT, abi: REVOCATION_ABI, functionName: "reinstate", args: [revokeAgent.trim() as `0x${string}`] });
  };

  // ─── UI helpers ───────────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-3">ᛟ</div>
        <p className="text-sm">Connect your wallet to interact with MimirWell</p>
      </div>
    );
  }

  const isRevoking = revokeIsPending || revokeConfirming;
  const isReinstating = reinstateIsPending || reinstateConfirming;
  const wrongNetwork = chainId !== mainnet.id;
  const isBusy = loading !== null || isRevoking || isReinstating;

  const inputClass = `
    w-full px-4 py-3 rounded-lg
    bg-[#0d1525]/80 border border-gray-700/50
    text-gray-200 placeholder-gray-600 text-sm
    focus:outline-none focus:border-[#00a8ff]/50 focus:shadow-[0_0_15px_rgba(0,168,255,0.1)]
    transition-all duration-200
  `;

  const btnClass = (color: string, disabled: boolean) => `
    px-5 py-3 rounded-lg font-semibold text-sm
    border transition-all duration-300
    ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"}
    ${color}
  `;

  return (
    <div className="space-y-8">

      {/* Identity banner */}
      {address && (
        <div className="px-4 py-3 rounded-lg text-xs font-mono bg-[#00a8ff]/5 border border-[#00a8ff]/20 text-[#00a8ff]/70 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5 shrink-0">ᛏ</span>
            <div className="flex-1 min-w-0">
              <span className="text-[#00a8ff]/60">Agent · your wallet · encryption identity</span>
              <div className="mt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[#00a8ff] truncate">{ownerEns ?? `${address.slice(0, 6)}…${address.slice(-4)}`}</span>
                  <button onClick={() => navigator.clipboard.writeText(address)} title="Copy" className="shrink-0 text-[#00a8ff]/40 hover:text-[#00a8ff] transition-colors cursor-pointer ml-auto">⎘</button>
                </div>
                {ownerEns && <div className="text-[#00a8ff]/30 text-xs mt-0.5">{address.slice(0, 6)}…{address.slice(-4)}</div>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-base mt-0.5 shrink-0">ᚨ</span>
            <div className="flex-1 min-w-0">
              <span className="text-[#14b8a6]/60">Owner · same wallet · holds the kill switch</span>
              <div className="mt-0.5">
                <span className="text-[#14b8a6] truncate block">{ownerEns ?? `${address.slice(0, 6)}…${address.slice(-4)}`}</span>
                {ownerEns && <div className="text-[#14b8a6]/30 text-xs mt-0.5">{address.slice(0, 6)}…{address.slice(-4)}</div>}
              </div>
            </div>
          </div>
          {/* Zero-knowledge indicator */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#00a8ff]/10">
            <span className="text-base shrink-0">🔑</span>
            <span className="text-[#00a8ff]/40 text-xs">
              {keyReady
                ? "Encryption key derived from wallet signature — ready"
                : "Encryption key derived from wallet signature on first use"}
            </span>
            {keyReady && <span className="ml-auto text-[#14b8a6]/60">✓ key ready</span>}
          </div>
        </div>
      )}

      {/* Status bar */}
      {status && (
        <div className={`
          px-4 py-2.5 rounded-lg text-sm font-mono break-all
          ${status.startsWith("✓")
            ? "bg-[#14b8a6]/10 border border-[#14b8a6]/30 text-[#14b8a6]"
            : status.startsWith("✗")
              ? "bg-red-500/10 border border-red-500/30 text-red-400"
              : "bg-[#00a8ff]/10 border border-[#00a8ff]/30 text-[#00a8ff]"
          }
        `}>
          {status}
        </div>
      )}

      {/* Wrong network warning */}
      {wrongNetwork && (
        <div className="px-4 py-2.5 rounded-lg text-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-between">
          <span>⚠ Switch to Ethereum Mainnet for revoke/reinstate</span>
          <button onClick={() => switchChain({ chainId: mainnet.id })} className="ml-4 underline cursor-pointer hover:text-amber-300">Switch</button>
        </div>
      )}

      {/* Remember */}
      <div className="rounded-xl border border-[#00a8ff]/20 bg-[#0a0f1a]/60 backdrop-blur-sm p-5">
        <h3 className="text-[#00a8ff] font-bold text-sm tracking-widest mb-4">ᚠ REMEMBER</h3>
        <p className="text-xs text-gray-500 mb-3">
          Content is encrypted in your browser before upload — MimirWell never sees the plaintext.
          Your wallet signature derives the AES-256 key. Only you can decrypt. Only you can revoke.
        </p>
        <textarea
          value={memoryText}
          onChange={(e) => setMemoryText(e.target.value)}
          placeholder="Enter the memory to encrypt and store on Filecoin…"
          rows={3}
          className={`${inputClass} resize-none mb-3`}
        />
        <button
          onClick={handleRemember}
          disabled={!memoryText.trim() || isBusy}
          className={btnClass(
            "border-[#00a8ff]/40 text-[#00a8ff] bg-[#00a8ff]/10 hover:bg-[#00a8ff]/20 hover:shadow-[0_0_20px_rgba(0,168,255,0.2)]",
            !memoryText.trim() || isBusy
          )}
        >
          {loading === "remember" ? "Encrypting & Storing…" : "Encrypt & Store →"}
        </button>
      </div>

      {/* Recall */}
      <div className="rounded-xl border border-[#14b8a6]/20 bg-[#0a0f1a]/60 backdrop-blur-sm p-5">
        <h3 className="text-[#14b8a6] font-bold text-sm tracking-widest mb-4">ᛖ RECALL</h3>
        <p className="text-xs text-gray-500 mb-3">
          Revocation is checked on-chain. The encrypted blob is returned and decrypted locally
          with your wallet key — zero-knowledge end to end.
        </p>
        <input
          value={recallCid}
          onChange={(e) => setRecallCid(e.target.value)}
          placeholder="Enter Filecoin CID…"
          className={`${inputClass} mb-3`}
        />
        <button
          onClick={handleRecall}
          disabled={!recallCid.trim() || isBusy}
          className={btnClass(
            "border-[#14b8a6]/40 text-[#14b8a6] bg-[#14b8a6]/10 hover:bg-[#14b8a6]/20 hover:shadow-[0_0_20px_rgba(20,184,166,0.2)]",
            !recallCid.trim() || isBusy
          )}
        >
          {loading === "recall" ? "Fetching & Decrypting…" : "Recall & Decrypt →"}
        </button>
      </div>

      {/* Revoke */}
      <div className="rounded-xl border border-red-500/20 bg-[#0a0f1a]/60 backdrop-blur-sm p-5">
        <h3 className="text-red-400 font-bold text-sm tracking-widest mb-1">ᛉ REVOKE ACCESS</h3>
        <p className="text-xs text-gray-500 mb-4">
          Your wallet signs directly on-chain. MetaMask will open — you pay ~$0.05 gas.
          No server involvement. <span className="text-red-400/60">Revocable on-chain. Reversible via Reinstate.</span>
          <br /><span className="text-gray-600">In this demo you are both agent and owner. In production: the human owner revokes the AI agent's address.</span>
        </p>
        <input
          value={revokeAgent}
          onChange={(e) => setRevokeAgent(e.target.value)}
          placeholder="Agent wallet address to revoke (0x…)"
          className={`${inputClass} mb-3`}
        />
        <button
          onClick={handleRevoke}
          disabled={!revokeAgent.trim() || isBusy}
          className={btnClass(
            wrongNetwork
              ? "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              : "border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]",
            !revokeAgent.trim() || isBusy
          )}
        >
          {wrongNetwork ? "Switch to Mainnet →" : isRevoking ? (revokeIsPending ? "Waiting for MetaMask…" : "Confirming on-chain…") : "Revoke Access → MetaMask"}
        </button>
        {revokeTxHash && (
          <a href={`https://etherscan.io/tx/${revokeTxHash}`} target="_blank" rel="noopener noreferrer"
            className="block mt-3 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors truncate">
            ↗ etherscan.io/tx/{revokeTxHash.slice(0, 20)}…
          </a>
        )}
      </div>

      {/* Reinstate */}
      <div className="rounded-xl border border-[#a78bfa]/20 bg-[#0a0f1a]/60 backdrop-blur-sm p-5">
        <h3 className="font-bold text-sm tracking-widest mb-1" style={{ color: "#a78bfa" }}>ᚱ REINSTATE ACCESS</h3>
        <p className="text-xs text-gray-500 mb-4">
          Undo a previous revocation. Your wallet signs on-chain — the pardon to the kill switch.
          ~$0.05 gas. Agent can recall again immediately after confirmation.
        </p>
        <input
          value={revokeAgent}
          onChange={(e) => setRevokeAgent(e.target.value)}
          placeholder="Agent wallet address to reinstate (0x…)"
          className={`${inputClass} mb-3`}
        />
        <button
          onClick={handleReinstate}
          disabled={!revokeAgent.trim() || isBusy}
          className={btnClass(
            wrongNetwork
              ? "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              : "border-[#a78bfa]/40 bg-[#a78bfa]/10 hover:bg-[#a78bfa]/20 hover:shadow-[0_0_20px_rgba(167,139,250,0.2)]",
            !revokeAgent.trim() || isBusy
          )}
          style={!wrongNetwork && !(!revokeAgent.trim() || isBusy) ? { color: "#a78bfa" } : {}}
        >
          {wrongNetwork ? "Switch to Mainnet →" : isReinstating ? (reinstateIsPending ? "Waiting for MetaMask…" : "Confirming on-chain…") : "Reinstate Access → MetaMask"}
        </button>
        {reinstateTxHash && (
          <a href={`https://etherscan.io/tx/${reinstateTxHash}`} target="_blank" rel="noopener noreferrer"
            className="block mt-3 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors truncate">
            ↗ etherscan.io/tx/{reinstateTxHash.slice(0, 20)}…
          </a>
        )}
      </div>

      {/* Memory feed */}
      {memories.length > 0 && (
        <div>
          <h3 className="text-gray-500 text-xs tracking-widest mb-3 uppercase">Memory Log</h3>
          <div className="space-y-3">
            {memories.map((m, i) => (
              <MemoryCard
                key={i}
                cid={m.cid}
                content={m.content}
                agentWallet={m.agentWallet}
                ownerWallet={m.ownerWallet}
                state={m.state}
                timestamp={m.timestamp}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
