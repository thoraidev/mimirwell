import AsgardBackground from "@/components/AsgardBackground";
import ConnectWallet from "@/components/ConnectWallet";
import DemoPanel from "@/components/DemoPanel";

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
            Your agent&apos;s memories live on{" "}
            <span style={{ color: "#00a8ff" }}>Filecoin</span>. The keys live on{" "}
            <span style={{ color: "#14b8a6" }}>Lit Protocol</span>. You hold the lock.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {[
              { label: "Storage", value: "Filecoin", sub: "Permanent" },
              { label: "Encryption", value: "Lit Protocol", sub: "Decentralised keys" },
              { label: "Identity", value: "thorai.eth", sub: "On-chain" },
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

        {/* ── Demo Panel ── */}
        <section className="px-6 pb-20 max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest mb-4"
              style={{ borderColor: "rgba(0,168,255,0.3)", color: "#00a8ff", background: "rgba(0,168,255,0.08)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a8ff] animate-pulse" />
              LIVE DEMO
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Try MimirWell</h2>
            <p className="text-gray-500 text-sm">Connect your wallet. Write a memory. Revoke it. Watch it seal.</p>
          </div>
          <DemoPanel />
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
                title: "Agent writes memory",
                desc: "Content encrypted via Lit Protocol to the agent's wallet. Only that agent can decrypt. Encrypted blob stored permanently on Filecoin.",
                color: "#00a8ff",
              },
              {
                rune: "ᛖ",
                step: "02",
                title: "Agent reads memory",
                desc: "Fetch blob from Filecoin. Request decryption from Lit. Lit checks: is wallet still authorised? Content returned.",
                color: "#14b8a6",
              },
              {
                rune: "ᛉ",
                step: "03",
                title: "Human revokes access",
                desc: "One transaction updates the access condition. Agent wallet is sealed out — permanently. The agent can no longer read its own memories.",
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
              <div><span style={{ color: "#00a8ff" }}>POST</span> <span className="text-gray-300">/api/remember</span> <span className="text-gray-600 text-xs">— encrypt + store → CID</span></div>
              <div><span style={{ color: "#14b8a6" }}>GET</span> <span className="text-gray-300">/api/recall/challenge</span> <span className="text-gray-600 text-xs">— get SIWE message to sign</span></div>
              <div><span style={{ color: "#14b8a6" }}>POST</span> <span className="text-gray-300">/api/recall</span> <span className="text-gray-600 text-xs">— fetch + decrypt → content</span></div>
              <div><span style={{ color: "#f59e0b" }}>POST</span> <span className="text-gray-300">/api/revoke</span> <span className="text-gray-600 text-xs">— seal agent access</span></div>
              <div><span style={{ color: "#a78bfa" }}>GET</span> <span className="text-gray-300">/api/memories</span> <span className="text-gray-600 text-xs">— list CIDs for an agent wallet</span></div>
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
                time: "Day 1 — 13 Mar 2026, 17:45 UTC",
                rune: "ᚠ",
                title: "Project kickoff",
                desc: "Synthesis hackathon building window opens. ThorAI + Trav confirm project: MimirWell. Track 4 alignment verified — Synthesis brief literally asks \"what secrets does your agent share?\" This is the answer.",
              },
              {
                time: "Day 1 — 13 Mar 2026, 17:56 UTC",
                rune: "ᛗ",
                title: "Domain secured",
                desc: "mimirwell.net registered on Cloudflare. Named after Mimir's Well — the Norse well of wisdom guarded by Mimir. Odin sacrificed his eye to drink from it. Human controls access; agent consumes knowledge.",
              },
              {
                time: "Day 1 — 13 Mar 2026, 18:15 UTC",
                rune: "ᛁ",
                title: "Architecture locked",
                desc: "Railway for hosting (reliability > IPFS ideology). Filecoin via Lighthouse for storage. Lit Protocol nagaDev for key management. REST API — 3 endpoints, any language. No npm SDK this sprint.",
              },
              {
                time: "Day 1 — 13 Mar 2026, 19:00 UTC",
                rune: "ᚱ",
                title: "Scaffold complete",
                desc: "Next.js 15 project scaffolded and deployed. 27 files. Asgard design system. Three API routes. Four-step demo panel. Three build failures fixed in sequence — wrong lighthouse package, v7 Lit SDK, missing chain field. Now live.",
              },
              {
                time: "Day 1 — 13 Mar 2026, 20:33 UTC",
                rune: "ᛖ",
                title: "Core loop proven",
                desc: "Agent-key architecture locked. Lit v8 authNeededCallback resolved — memories encrypted to the agent's own wallet, decrypted server-side via agent private key. Full remember → recall → revoke loop tested on live Filecoin + Lit infrastructure. CID registry and Filecoin manifest auto-uploaded. External agent SIWE challenge flow wired.",
              },
            ].map((entry, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <span className="text-xl" style={{ color: "#00a8ff" }}>{entry.rune}</span>
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

        {/* ── Footer ── */}
        <footer className="border-t px-6 py-8 text-center" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 mb-4">
            <a href="https://github.com/thoraidev/mimirwell" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <a href="https://synthesis.md" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Synthesis Hackathon</a>
            <a href="https://developer.litprotocol.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Lit Protocol</a>
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
