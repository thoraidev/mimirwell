"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [ensName, setEnsName] = useState<string | null>(null);

  // Reverse ENS resolution — bypass wagmi reads (transport broken), use server endpoint
  useEffect(() => {
    if (!address) { setEnsName(null); return; }
    setEnsName(null); // reset on wallet change
    fetch(`/api/ens-lookup?address=${address}`)
      .then(r => r.json())
      .then(d => { if (d.name) setEnsName(d.name); })
      .catch(() => { /* silently fall back to hex */ });
  }, [address]);

  const displayName = ensName ?? (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "");

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00a8ff]/30 bg-[#00a8ff]/5">
          <div className="w-2 h-2 rounded-full bg-[#14b8a6] shadow-[0_0_6px_#14b8a6] animate-pulse" />
          <span className="text-sm font-mono text-[#14b8a6]">
            {displayName}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 text-xs text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-400/50 rounded-lg transition-all duration-200"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      disabled={isPending}
      className="
        relative px-6 py-2.5 rounded-lg font-semibold text-sm
        border border-[#00a8ff]/50 text-[#00a8ff]
        bg-[#00a8ff]/10 hover:bg-[#00a8ff]/20
        shadow-[0_0_20px_rgba(0,168,255,0.15)]
        hover:shadow-[0_0_30px_rgba(0,168,255,0.3)]
        transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {isPending ? (
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border border-[#00a8ff] border-t-transparent rounded-full animate-spin" />
          Connecting…
        </span>
      ) : (
        "Connect Wallet"
      )}
    </button>
  );
}
