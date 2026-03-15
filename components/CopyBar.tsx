"use client";

import { useState } from "react";

export default function CopyBar({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="w-full flex items-center gap-3 px-6 py-3 rounded-xl border font-mono text-sm transition-all hover:border-[#14b8a6]/50 hover:bg-[#14b8a6]/08 active:scale-[0.99]"
      style={{
        borderColor: "rgba(20,184,166,0.2)",
        background: "rgba(20,184,166,0.03)",
        color: copied ? "#14b8a6" : "#14b8a6",
      }}
    >
      {/* Copy / check icon */}
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M3 8l3.5 3.5L13 5" stroke="#14b8a6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <rect x="5" y="1" width="9" height="11" rx="1.5" stroke="#14b8a6" strokeWidth="1.4" />
          <rect x="2" y="4" width="9" height="11" rx="1.5" stroke="#14b8a6" strokeWidth="1.4" fill="rgba(20,184,166,0.06)" />
        </svg>
      )}
      <span style={{ opacity: copied ? 1 : 0.8 }}>
        {copied ? "Copied!" : url}
      </span>
    </button>
  );
}
