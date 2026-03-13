"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import MemoryCard, { type MemoryState } from "./MemoryCard";

interface MemoryEntry {
  cid: string;
  content?: string;
  wallet: string;
  state: MemoryState;
  timestamp: number;
}

export default function DemoPanel() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [memoryText, setMemoryText] = useState("");
  const [recallCid, setRecallCid] = useState("");
  const [revokeAgent, setRevokeAgent] = useState("");
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<"remember" | "recall" | "revoke" | null>(null);

  const getAuthSig = async () => {
    if (!address) throw new Error("Wallet not connected");
    const message = createSiweMessage({
      domain: window.location.host,
      address,
      statement: "Sign to authenticate with MimirWell",
      uri: window.location.origin,
      version: "1",
      chainId: 1,
      nonce: Math.random().toString(36).slice(2),
    });
    const sig = await signMessageAsync({ message });
    return { sig, derivedVia: "web3.eth.personal.sign", signedMessage: message, address };
  };

  const handleRemember = async () => {
    if (!address || !memoryText.trim()) return;
    setLoading("remember");
    setStatus("Encrypting with Lit Protocol…");
    try {
      const res = await fetch("/api/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: memoryText.trim(), wallet: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemories((prev) => [
        { cid: data.cid, content: memoryText.trim(), wallet: address, state: "stored", timestamp: Date.now() },
        ...prev,
      ]);
      setMemoryText("");
      setStatus(`✓ Memory stored on Filecoin — CID: ${data.cid.slice(0, 12)}…`);
    } catch (e) {
      setStatus(`✗ Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(null);
    }
  };

  const handleRecall = async () => {
    if (!address || !recallCid.trim()) return;
    setLoading("recall");
    setStatus("Requesting decryption from Lit Protocol…");
    try {
      const authSig = await getAuthSig();
      const res = await fetch("/api/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: recallCid.trim(), wallet: address, authSig }),
      });
      const data = await res.json();
      if (data.status === "denied") {
        setMemories((prev) => [
          { cid: recallCid.trim(), wallet: address, state: "sealed", timestamp: Date.now() },
          ...prev,
        ]);
        setStatus("✗ Access denied — memory is sealed");
      } else if (res.ok) {
        setMemories((prev) => [
          { cid: recallCid.trim(), content: data.content, wallet: address, state: "recalled", timestamp: Date.now() },
          ...prev,
        ]);
        setRecallCid("");
        setStatus("✓ Memory recalled successfully");
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      setStatus(`✗ Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!address || !revokeAgent.trim()) return;
    setLoading("revoke");
    setStatus("Revoking access…");
    try {
      const res = await fetch("/api/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentWallet: revokeAgent.trim(), ownerWallet: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRevokeAgent("");
      setStatus(`✓ Access revoked for ${revokeAgent.slice(0, 8)}…`);
    } catch (e) {
      setStatus(`✗ Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-3">ᛟ</div>
        <p className="text-sm">Connect your wallet to interact with MimirWell</p>
      </div>
    );
  }

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
      {/* Status bar */}
      {status && (
        <div className={`
          px-4 py-2.5 rounded-lg text-sm font-mono
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

      {/* Remember */}
      <div className="rounded-xl border border-[#00a8ff]/20 bg-[#0a0f1a]/60 backdrop-blur-sm p-5">
        <h3 className="text-[#00a8ff] font-bold text-sm tracking-widest mb-4">ᚠ REMEMBER</h3>
        <textarea
          value={memoryText}
          onChange={(e) => setMemoryText(e.target.value)}
          placeholder="Enter the memory to encrypt and store on Filecoin…"
          rows={3}
          className={`${inputClass} resize-none mb-3`}
        />
        <button
          onClick={handleRemember}
          disabled={!memoryText.trim() || loading !== null}
          className={btnClass(
            "border-[#00a8ff]/40 text-[#00a8ff] bg-[#00a8ff]/10 hover:bg-[#00a8ff]/20 hover:shadow-[0_0_20px_rgba(0,168,255,0.2)]",
            !memoryText.trim() || loading !== null
          )}
        >
          {loading === "remember" ? "Encrypting & Storing…" : "Store Memory →"}
        </button>
      </div>

      {/* Recall */}
      <div className="rounded-xl border border-[#14b8a6]/20 bg-[#0a0f1a]/60 backdrop-blur-sm p-5">
        <h3 className="text-[#14b8a6] font-bold text-sm tracking-widest mb-4">ᛖ RECALL</h3>
        <input
          value={recallCid}
          onChange={(e) => setRecallCid(e.target.value)}
          placeholder="Enter Filecoin CID…"
          className={`${inputClass} mb-3`}
        />
        <button
          onClick={handleRecall}
          disabled={!recallCid.trim() || loading !== null}
          className={btnClass(
            "border-[#14b8a6]/40 text-[#14b8a6] bg-[#14b8a6]/10 hover:bg-[#14b8a6]/20 hover:shadow-[0_0_20px_rgba(20,184,166,0.2)]",
            !recallCid.trim() || loading !== null
          )}
        >
          {loading === "recall" ? "Decrypting…" : "Recall Memory →"}
        </button>
      </div>

      {/* Revoke */}
      <div className="rounded-xl border border-red-500/20 bg-[#0a0f1a]/60 backdrop-blur-sm p-5">
        <h3 className="text-red-400 font-bold text-sm tracking-widest mb-4">ᛉ REVOKE ACCESS</h3>
        <input
          value={revokeAgent}
          onChange={(e) => setRevokeAgent(e.target.value)}
          placeholder="Agent wallet address to revoke (0x…)"
          className={`${inputClass} mb-3`}
        />
        <button
          onClick={handleRevoke}
          disabled={!revokeAgent.trim() || loading !== null}
          className={btnClass(
            "border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]",
            !revokeAgent.trim() || loading !== null
          )}
        >
          {loading === "revoke" ? "Revoking…" : "Revoke Access →"}
        </button>
      </div>

      {/* Memory feed */}
      {memories.length > 0 && (
        <div>
          <h3 className="text-gray-500 text-xs tracking-widest mb-3 uppercase">Memory Log</h3>
          <div className="space-y-3">
            {memories.map((m, i) => (
              <MemoryCard key={i} {...m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
