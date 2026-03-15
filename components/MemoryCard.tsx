"use client";

import { useState, useEffect } from "react";

export type MemoryState = "stored" | "recalled" | "sealed" | "idle";

interface MemoryCardProps {
  cid?: string;
  content?: string;
  agentWallet?: string;
  ownerWallet?: string;
  state?: MemoryState;
  timestamp?: number;
}

const STATE_RUNES: Record<MemoryState, string[]> = {
  stored: ["ᚠ", "ᛗ", "ᛁ", "ᚱ"],
  recalled: ["ᛖ", "ᚾ", "ᛏ", "ᛃ"],
  sealed: ["ᛉ", "ᚷ", "ᛒ", "ᚲ"],
  idle: ["ᛟ", "ᛞ", "ᛚ", "ᛜ"],
};

const STATE_CONFIG: Record<MemoryState, { border: string; glow: string; label: string; textColor: string }> = {
  stored: {
    border: "border-[#00a8ff]/40",
    glow: "shadow-[0_0_20px_rgba(0,168,255,0.2)]",
    label: "STORED",
    textColor: "text-[#00a8ff]",
  },
  recalled: {
    border: "border-[#14b8a6]/40",
    glow: "shadow-[0_0_20px_rgba(20,184,166,0.2)]",
    label: "RECALLED",
    textColor: "text-[#14b8a6]",
  },
  sealed: {
    border: "border-red-500/40",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    label: "SEALED",
    textColor: "text-red-400",
  },
  idle: {
    border: "border-gray-700/40",
    glow: "",
    label: "IDLE",
    textColor: "text-gray-500",
  },
};

export default function MemoryCard({ cid, content, agentWallet, ownerWallet, state = "idle", timestamp }: MemoryCardProps) {
  const [copied, setCopied] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const cfg = STATE_CONFIG[state];
  const runes = STATE_RUNES[state];

  const sameWallet = agentWallet && ownerWallet &&
    agentWallet.toLowerCase() === ownerWallet.toLowerCase();

  // Resolve ENS for agent wallet
  useEffect(() => {
    if (!agentWallet) return;
    setAgentName(null);
    fetch(`/api/ens-lookup?address=${encodeURIComponent(agentWallet)}`)
      .then(r => r.json())
      .then(d => setAgentName(d.name ?? null))
      .catch(() => {});
  }, [agentWallet]);

  // Resolve ENS for owner wallet (skip if same as agent)
  useEffect(() => {
    if (!ownerWallet || sameWallet) return;
    setOwnerName(null);
    fetch(`/api/ens-lookup?address=${encodeURIComponent(ownerWallet)}`)
      .then(r => r.json())
      .then(d => setOwnerName(d.name ?? null))
      .catch(() => {});
  }, [ownerWallet, sameWallet]);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`
        relative rounded-xl border ${cfg.border} ${cfg.glow}
        bg-gradient-to-br from-[#0d1525]/80 to-[#0a0f1a]/90
        backdrop-blur-sm p-5 transition-all duration-500
      `}
    >
      {/* State badge + rune row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`
              text-xs font-bold tracking-widest px-2 py-0.5 rounded
              border ${cfg.border} ${cfg.textColor}
              ${state === "sealed" ? "opacity-60" : ""}
            `}
          >
            {cfg.label}
          </span>
          {timestamp && (
            <span className="text-xs text-gray-600">
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Animated rune cluster */}
        <div className="flex gap-1">
          {runes.map((r, i) => (
            <span
              key={i}
              className={`
                text-sm transition-all duration-300
                ${state === "sealed" ? "text-red-800/60" : cfg.textColor}
                ${state !== "idle" ? "animate-pulse" : "opacity-30"}
              `}
              style={{ animationDelay: `${i * 150}ms` }}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* CID */}
      {cid && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Filecoin CID</div>
          <button
            onClick={() => copyToClipboard(cid)}
            className="font-mono text-xs text-[#00a8ff]/70 hover:text-[#00a8ff] transition-colors break-all text-left"
            title="Click to copy"
          >
            {copied ? "✓ Copied!" : cid}
          </button>
        </div>
      )}

      {/* Agent + Owner */}
      {agentWallet && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">
            {sameWallet ? "Wallet · agent & owner" : "Agent"}
          </div>
          <div className="font-mono text-xs text-gray-400">
            {agentName ?? `${agentWallet.slice(0, 8)}…${agentWallet.slice(-6)}`}
          </div>
        </div>
      )}
      {ownerWallet && !sameWallet && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">Owner · kill switch</div>
          <div className="font-mono text-xs text-gray-400">
            {ownerName ?? `${ownerWallet.slice(0, 8)}…${ownerWallet.slice(-6)}`}
          </div>
        </div>
      )}

      {/* Content */}
      {content && state !== "sealed" && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="text-xs text-gray-500 mb-1">Memory</div>
          <p className={`text-sm ${cfg.textColor} leading-relaxed`}>{content}</p>
        </div>
      )}

      {/* Sealed overlay */}
      {state === "sealed" && (
        <div className="mt-3 pt-3 border-t border-red-900/30 text-center">
          <span className="text-red-700 text-xs tracking-widest">ᛉ ACCESS SEALED ᛉ</span>
        </div>
      )}
    </div>
  );
}
