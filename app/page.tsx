import AsgardBackground from "@/components/AsgardBackground";
import ConnectWallet from "@/components/ConnectWallet";
import DemoPanel from "@/components/DemoPanel";
import LiveTerminal from "@/components/LiveTerminal";

export default function Home() {
  return (
    <div className="relative min-h-screen font-sans" style={{ background: "#0a0f1a", color: "#fff" }}>
      {/* Animated rune background */}
      <AsgardBackground />

      {/* Content layer */}
      <div className="relative z-10">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-6 py-5 border-b border-white/5 backdrop-blur-sm sticky top-0 z-50" style={{ background: "rgba(6,11,20,0.85)" }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl" style={{ color: "#00a8ff", textShadow: "0 0 12px rgba(0,168,255,0.6)" }}>ᛗ</span>
            <span className="font-bold text-lg tracking-wide text-white">MimirWell</span>
            <span className="text-xs px-2 py-0.5 rounded border text-gray-400 border-gray-700 ml-1">BETA</span>
          </div>
          <ConnectWallet />
        </header>

        {/* ── Hero ── */}
        <section className="text-center px-6 pt-20 pb-16 max-w-4xl mx-auto">
          {/* Rune decorators */}
          <div className="flex justify-center gap-6 mb-8 text-3xl" style={{ color: "rgba(0,168,255,0.3)" }}>
            <span className="animate-pulse" style={{ animationDelay: "0ms" }}>ᚠ</span>
            <span className="animate-pulse" style={{ animationDelay: "200ms", color: "rgba(20,184,166,0.3)" }}>ᛗ</span>
            <span className="animate-pulse" style={{ animationDelay: "400ms", color: "rgba(245,158,11,0.3)" }}>ᛁ</span>
            <span className="animate-pulse" style={{ animationDelay: "600ms", color: "rgba(0,168,255,0.3)" }}>ᚱ</span>
            <span className="animate-pulse" style={{ animationDelay: "800ms", color: "rgba(20,184,166,0.3)" }}>ᛖ</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight mb-6">
            <span style={{ color: "#00a8ff", textShadow: "0 0 40px rgba(0,168,255,0.4)" }}>Sovereign</span>
            <br />
            <span className="text-white">Encrypted Memory</span>
            <br />
            <span style={{ color: "#14b8a6", textShadow: "0 0 30px rgba(20,184,166,0.3)" }}>for AI Agents</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Your agent encrypts locally.{" "}
            <span style={{ color: "#00a8ff" }}>We store what we can&apos;t read.</span>{" "}
            You hold the{" "}
            <span style={{ color: "#14b8a6" }}>kill switch.</span>
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {[
              { label: "Storage", value: "Filecoin", sub: "Permanent" },
              { label: "Encryption", value: "AES-256-GCM", sub: "Zero-knowledge" },
              { label: "Identity", value: "ENS / Ethereum", sub: "Agent-sovereign" },
              { label: "API", value: "3 endpoints", sub: "Any language" },
            ].map((s) => (
              <div
                key={s.label}
                className="px-5 py-3 rounded-xl border text-left"
                style={{ borderColor: "rgba(0,168,255,0.15)", background: "rgba(0,168,255,0.04)" }}
              >
                <div className="text-xs text-gray-500 mb-0.5 uppercase tracking-widest">{s.label}</div>
                <div className="text-sm font-bold text-white">{s.value}</div>
                <div className="text-xs" style={{ color: "#14b8a6" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Demo + Live Terminal (side-by-side) ── */}
        <section className="px-6 pb-20 max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest mb-4"
              style={{ borderColor: "rgba(0,168,255,0.3)", color: "#00a8ff", background: "rgba(0,168,255,0.08)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a8ff] animate-pulse" />
              LIVE DEMO
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Try MimirWell</h2>
            <p className="text-gray-500 text-sm">Connect your wallet. Write a memory. Revoke it. Watch it seal in real time.</p>
          </div>

          {/* Side-by-side grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch">

            {/* Left: Demo Panel */}
            <div className="lg:col-span-2 flex flex-col">
              <DemoPanel />
            </div>

            {/* Right: Live Terminal */}
            <div className="lg:col-span-3 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "#00a8ff", boxShadow: "0 0 6px #00a8ff" }}
                />
                <span className="text-xs font-bold tracking-widest" style={{ color: "#00a8ff" }}>
                  LIVE NETWORK ACTIVITY
                </span>
                <span className="text-xs text-gray-600 ml-2 hidden sm:inline">— encrypt fragments visible, plaintext never exposed</span>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <LiveTerminal />
              </div>
            </div>

          </div>
        </section>

        {/* ── Architecture ── */}
        <section className="px-6 pb-20 max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">How It Works</h2>
            <p className="text-gray-500 text-sm">Three layers. No single point of failure.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                rune: "ᚠ",
                step: "01",
                title: "Agent encrypts locally",
                desc: "Your agent derives an AES-256-GCM key from its wallet signature. Memory is encrypted before the API call. MimirWell receives only ciphertext — never plaintext.",
                color: "#00a8ff",
              },
              {
                rune: "ᛖ",
                step: "02",
                title: "Agent recalls memory",
                desc: "MimirWell checks revocation on Ethereum mainnet, then returns the encrypted blob. The agent decrypts locally. The server is a zero-knowledge pass-through.",
                color: "#14b8a6",
              },
              {
                rune: "ᛉ",
                step: "03",
                title: "Human holds the kill switch",
                desc: "One MetaMask transaction calls revoke() on Ethereum mainnet. The next recall returns 403. Reinstate restores access. You are always in control.",
                color: "#f59e0b",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border p-6"
                style={{ borderColor: `${item.color}25`, background: `${item.color}06` }}
              >
                <div className="text-3xl mb-3" style={{ color: item.color, textShadow: `0 0 15px ${item.color}80` }}>
                  {item.rune}
                </div>
                <div className="text-xs tracking-widest mb-2" style={{ color: item.color }}>{item.step}</div>
                <h3 className="font-bold text-white mb-2 text-sm">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* API reference */}
          <div
            className="mt-8 rounded-xl border p-6"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-xs tracking-widest text-gray-500 mb-4 uppercase">API — Any agent, any language</h3>
            <div className="space-y-2 font-mono text-sm">
              <div><span style={{ color: "#00a8ff" }}>POST</span> <span className="text-gray-300">/api/remember</span> <span className="text-gray-600 text-xs">— store pre-encrypted blob → CID</span></div>
              <div><span style={{ color: "#14b8a6" }}>POST</span> <span className="text-gray-300">/api/recall</span> <span className="text-gray-600 text-xs">— revocation check → return blob (agent decrypts locally)</span></div>
              <div><span style={{ color: "#f59e0b" }}>POST</span> <span className="text-gray-300">/api/revoke</span> <span className="text-gray-600 text-xs">— seal agent access on Ethereum mainnet</span></div>
              <div><span style={{ color: "#a78bfa" }}>POST</span> <span className="text-gray-300">/api/reinstate</span> <span className="text-gray-600 text-xs">— restore agent access on Ethereum mainnet</span></div>
              <div><span style={{ color: "#6b7280" }}>GET</span> <span className="text-gray-300">/api/activity</span> <span className="text-gray-600 text-xs">— last 20 operations (no auth, nothing sensitive)</span></div>
            </div>
          </div>
        </section>

        {/* ── Build Log ── */}
        <section className="px-6 pb-20 max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">Build Log</h2>
            <p className="text-gray-500 text-sm">ThorAI + Trav — Synthesis Hackathon 2026 — Track 4: Agents that Keep Secrets</p>
          </div>

          <div
            className="rounded-xl border p-6 space-y-5"
            style={{ borderColor: "rgba(0,168,255,0.1)", background: "rgba(0,168,255,0.03)" }}
          >
            {[
              {
                time: "Day 1 — 13 Mar 2026",
                rune: "ᚠ",
                title: "Project + architecture locked",
                desc: "ThorAI + Trav define MimirWell: sovereign encrypted memory for AI agents. Stack: Filecoin (Lighthouse) for storage, Ethereum mainnet for revocation, Railway for API. Critical decision: agentWallet ≠ ownerWallet. Agent decrypts. Human revokes. Same wallet breaks the demo. Named after Mimir's Well — Odin sacrificed his eye to drink from it. Human controls access; agent consumes knowledge.",
                color: "#00a8ff",
              },
              {
                time: "Day 2 — 13 Mar 2026",
                rune: "ᛖ",
                title: "Contract deployed + two-actor revocation proven",
                desc: "MimirWellRevocation.sol deployed to Ethereum mainnet (0x520b...3258, ~$0.05). LiveTerminal built — polls /api/activity, typewriter effect, ENS names. Full loop proven: ThorAI stored memory in terminal. Trav connected trav.eth in MetaMask → clicked Revoke → mainnet tx confirmed. ThorAI called /api/recall → 403 DENIED. Two actors. Real mainnet.",
                color: "#14b8a6",
              },
              {
                time: "Day 3 — 15 Mar 2026",
                rune: "ᛉ",
                title: "The pivot: zero-knowledge architecture",
                desc: "Lit Protocol nagaDev cluster went offline. But more importantly: server-side decryption — even via Lit — makes MimirWell a trusted intermediary. That contradicts the zero-knowledge claim. Decision: agents encrypt locally. MimirWell stores what it cannot read. HKDF-SHA256 + AES-256-GCM using Node.js built-ins. Zero external dependencies. The DemoPanel moved to Web Crypto API — MetaMask signs once to derive the key, encryption and decryption happen entirely in the browser. This is not a compromise forced by an outage. It is architecturally stronger than what we had before.",
                color: "#f59e0b",
              },
              {
                time: "Day 4 — 15 Mar 2026",
                rune: "ᛏ",
                title: "thorai.eth + AGENT.md + demo script",
                desc: "thorai.eth established as ThorAI's canonical agent identity. Keyring proxy signs the derivation message with thorai.eth → HKDF → AES key — identical algorithm to the browser. demo-thorai.mjs: ThorAI signs, encrypts, stores on Filecoin as thorai.eth, recalls, decrypts, verifies integrity. trav.eth is the owner. AGENT.md live at mimirwell.net/AGENT.md — any agent can self-onboard in under an hour.",
                color: "#a78bfa",
              },
            ].map((entry, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <span className="text-xl" style={{ color: entry.color, textShadow: `0 0 10px ${entry.color}60` }}>{entry.rune}</span>
                  {i < 3 && <div className="w-px flex-1 mt-2" style={{ background: "rgba(0,168,255,0.1)" }} />}
                </div>
                <div className="pb-4">
                  <div className="text-xs text-gray-600 mb-1 font-mono">{entry.time}</div>
                  <div className="font-bold text-white text-sm mb-1">{entry.title}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{entry.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Build Log Link ── */}
        <div className="px-6 pb-10 max-w-4xl mx-auto text-center -mt-10">
          <a
            href="https://github.com/thoraidev/mimirwell"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-mono text-gray-600 hover:text-[#00a8ff] transition-colors"
          >
            <span>→ Full build log with architecture decisions</span>
            <span style={{ opacity: 0.4 }}>↗</span>
          </a>
        </div>

        {/* ── Footer ── */}
        <footer className="border-t px-6 py-8 text-center" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 mb-4">
            <a href="https://github.com/thoraidev/mimirwell" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <a href="https://synthesis.md" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Synthesis Hackathon</a>
            <a href="https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Revocation Contract</a>
            <a href="https://lighthouse.storage" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Lighthouse</a>
          </div>
          <div className="text-xs text-gray-700">
            Built by{" "}
            <span style={{ color: "#00a8ff" }}>ThorAI</span> + Trav · Synthesis Hackathon 2026 · Track 4: Agents that Keep Secrets
          </div>
          <div className="text-gray-800 text-lg mt-3 tracking-widest">ᚠ ᛗ ᛁ ᚱ ᛖ ᛏ ᛟ</div>
        </footer>

      </div>
    </div>
  );
}
