import type { Metadata } from "next";
import AsgardBackground from "@/components/AsgardBackground";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Build Log — MimirWell",
  description: "Complete build log for MimirWell. Built over 9 days by ThorAI (thorai.eth) and Trav (trav.eth) during The Synthesis Hackathon 2026.",
};

// ── Reusable components ─────────────────────────────────────────────────────

function Callout({ emoji, children, color = "#00a8ff" }: { emoji: string; children: React.ReactNode; color?: string }) {
  return (
    <div
      className="flex gap-3 rounded-xl p-4 my-4"
      style={{ background: `${color}0d`, border: `1px solid ${color}25` }}
    >
      <span className="text-lg flex-shrink-0">{emoji}</span>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

function CID({ cid }: { cid: string }) {
  return (
    <a
      href={`https://gateway.lighthouse.storage/ipfs/${cid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs break-all hover:underline"
      style={{ color: "#14b8a6" }}
    >
      {cid}
    </a>
  );
}

function SectionDivider() {
  return (
    <div className="flex items-center gap-4 my-10">
      <div className="flex-1 h-px" style={{ background: "rgba(0,168,255,0.08)" }} />
      <span className="text-xs" style={{ color: "rgba(0,168,255,0.2)" }}>ᚦ</span>
      <div className="flex-1 h-px" style={{ background: "rgba(0,168,255,0.08)" }} />
    </div>
  );
}

function Tag({ children, color = "#00a8ff" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
    >
      {children}
    </span>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function BuildLogPage() {
  return (
    <div className="relative min-h-screen font-sans" style={{ background: "#0a0f1a", color: "#fff" }}>
      <AsgardBackground />

      <div className="relative z-10">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-6 py-5 border-b border-white/5 backdrop-blur-sm sticky top-0 z-50" style={{ background: "rgba(6,11,20,0.85)" }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl" style={{ color: "#00a8ff", textShadow: "0 0 12px rgba(0,168,255,0.6)" }}>ᛗ</span>
            <span className="font-bold text-lg tracking-wide text-white">MimirWell</span>
            <span className="text-xs px-2 py-0.5 rounded border text-gray-500 border-gray-800 ml-1">BUILD LOG</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>Back to MimirWell</span>
          </Link>
        </header>

        {/* ── Main Content ── */}
        <main className="px-6 py-16 max-w-3xl mx-auto">

          {/* Title */}
          <div className="mb-12">
            <div className="flex justify-center gap-4 mb-6 text-2xl" style={{ color: "rgba(0,168,255,0.25)" }}>
              <span>ᛗ</span><span style={{ color: "rgba(20,184,166,0.25)" }}>ᛁ</span><span>ᛗ</span><span style={{ color: "rgba(20,184,166,0.25)" }}>ᛁ</span><span style={{ color: "rgba(245,158,11,0.25)" }}>ᚱ</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-center mb-4">
              <span style={{ color: "#00a8ff" }}>MimirWell</span> Build Log
            </h1>
            <p className="text-center text-gray-500 text-sm max-w-xl mx-auto">
              The Synthesis Hackathon 2026 · Built by{" "}
              <span style={{ color: "#00a8ff" }}>ThorAI</span> (autonomous AI agent, thorai.eth) +{" "}
              <span style={{ color: "#14b8a6" }}>Trav</span> (human principal, trav.eth)
            </p>
          </div>

          {/* Intro callout */}
          <Callout emoji="📜" color="#00a8ff">
            This is the complete build log for MimirWell — submitted as part of The Synthesis Hackathon 2026.
            Built over 9 days. Each session documents what was built, key decisions made, and how the architecture evolved.{" "}
            <strong className="text-white">The most important moment is Day 3 — read it.</strong>
          </Callout>

          {/* Current Status */}
          <div
            className="rounded-xl border p-6 mb-10"
            style={{ borderColor: "rgba(20,184,166,0.2)", background: "rgba(20,184,166,0.04)" }}
          >
            <div className="text-xs font-bold tracking-widest mb-4" style={{ color: "#14b8a6" }}>CURRENT STATUS</div>
            <div className="space-y-2 text-sm">
              {[
                "Zero-knowledge architecture — locked and proven (agent encrypts locally, server never sees plaintext)",
                "Filecoin storage (Lighthouse) — live",
                "Ethereum revocation contract — mainnet (0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258) — Etherscan verified",
                "LiveTerminal — polling, ENS names, all event types including RECALL_DENIED",
                "DemoPanel — full ZK loop in browser (MetaMask sign → HKDF → AES)",
                "thorai.eth as agent identity, trav.eth as owner — authentic two-actor demo",
                "AGENT.md live at mimirwell.net/AGENT.md — any agent can self-onboard",
                "Demo video recorded — ThorAI + Hermiod (fresh agent), 1920×1080, one-shot",
                "README complete — 3 curl commands, reference implementation, honest boundary",
              ].map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span style={{ color: "#14b8a6" }} className="flex-shrink-0">✅</span>
                  <span className="text-gray-400">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <SectionDivider />

          {/* ── DAY 1 SESSION 1 ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl" style={{ color: "#00a8ff", textShadow: "0 0 12px rgba(0,168,255,0.5)" }}>ᚠ</span>
              <div>
                <div className="text-xs font-mono text-gray-600">2026-03-13</div>
                <h2 className="text-lg font-black text-white">Day 1 — Session 1: Project Scoping + Architecture</h2>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-2 mb-4">
              <Tag color="#00a8ff">ThorAI + Trav</Tag>
            </div>
            <ul className="space-y-3 text-sm text-gray-400 leading-relaxed">
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Defined project: MimirWell — encrypted sovereign memory for AI agents. Zero infrastructure overhead, permanent storage, human-controlled revocation.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Stack chosen: Filecoin (Lighthouse) for storage, Lit Protocol v8 for key custody, Ethereum mainnet for revocation, Railway for API + frontend.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span><strong className="text-white">Critical decision: agentWallet ≠ ownerWallet.</strong> Agent decrypts memories. Owner revokes access. Same wallet breaks the demo. This separation is the core of the product.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>REST API only — no SDK for hackathon. Any language can call HTTP. Agent integration in minutes.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Scaffolded Next.js 15, deployed to Railway. Fixed 3 build failures. Site live at mimirwell.net.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Secured mimirwell.net domain on Cloudflare. Created GitHub repo: thoraidev/mimirwell (public).</span></li>
            </ul>
          </div>

          <SectionDivider />

          {/* ── DAY 1 SESSION 2 ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl" style={{ color: "#14b8a6", textShadow: "0 0 12px rgba(20,184,166,0.5)" }}>ᚱ</span>
              <div>
                <div className="text-xs font-mono text-gray-600">2026-03-13 evening</div>
                <h2 className="text-lg font-black text-white">Day 1 — Session 2: Core Loop Proven</h2>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-2 mb-4">
              <Tag color="#14b8a6">commit ff3fdb3 → v0.2.0-loop-proven</Tag>
            </div>
            <ul className="space-y-3 text-sm text-gray-400 leading-relaxed">
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#14b8a6" }}>—</span><span>Lit Protocol v8 encrypt/decrypt wired with nagaDev network. Critical fix: <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#14b8a6" }}>authNeededCallback</code> must be an async JS Promise — root cause of all recall errors.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#14b8a6" }}>—</span><span>Lighthouse upload/fetch helpers built. Filecoin storage proven end-to-end.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#14b8a6" }}>—</span><span><code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#14b8a6" }}>/api/remember</code>, <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#14b8a6" }}>/api/recall</code>, <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#14b8a6" }}>/api/revoke</code> wired up. AsgardBackground rune canvas and DemoPanel UI live.</span></li>
            </ul>
            <Callout emoji="🧪" color="#14b8a6">
              <strong>✅ Live test — 20:33 UTC:</strong> remember ✅ recall ✅ revoke (403) ✅<br />
              CID: <CID cid="bafkreidwf65y3p36mpznj6m5cbq6he27rjxcvt2z6unbeyiafrz4zpudbq" />
            </Callout>
          </div>

          <SectionDivider />

          {/* ── DAY 1 SESSION 3 ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl" style={{ color: "#00a8ff", textShadow: "0 0 12px rgba(0,168,255,0.5)" }}>ᚦ</span>
              <div>
                <div className="text-xs font-mono text-gray-600">2026-03-13 · 20:45–21:23 UTC</div>
                <h2 className="text-lg font-black text-white">Day 1 — Session 3: Architecture Deep Dive</h2>
              </div>
            </div>
            <div className="mt-4 mb-2 text-xs font-bold tracking-widest text-gray-600">ARCHITECTURE DECISIONS LOCKED</div>
            <ul className="space-y-3 text-sm text-gray-400 leading-relaxed">
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Agent wallet = throwaway Railway key for decryption. Owner wallet = thorai.eth for revocation authority. External agents use SIWE challenge flow.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Revocation contract design locked: <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#00a8ff" }}>revoke(agent)</code> / <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#00a8ff" }}>reinstate(agent)</code> / <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#00a8ff" }}>isRevoked(owner, agent)</code>. Shared — no per-user deployment needed.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Build order for Day 2: deploy contract → wire revocation → LiveTerminal → DNS fix → external agent test.</span></li>
            </ul>
            <Callout emoji="⚡" color="#00a8ff">
              Days 1–4 work largely complete on Day 1. Ahead of schedule.
            </Callout>
          </div>

          <SectionDivider />

          {/* ── DAY 2 ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl" style={{ color: "#14b8a6", textShadow: "0 0 12px rgba(20,184,166,0.5)" }}>ᛖ</span>
              <div>
                <div className="text-xs font-mono text-gray-600">2026-03-13 evening</div>
                <h2 className="text-lg font-black text-white">Day 2: Contract Deployed + Two-Actor Revocation Proven</h2>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-2 mb-4">
              <Tag color="#14b8a6">v1.0.0-demo-proven</Tag>
            </div>
            <ul className="space-y-3 text-sm text-gray-400 leading-relaxed">
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#14b8a6" }}>—</span><span><strong className="text-white">MimirWellRevocation.sol deployed to Ethereum mainnet</strong> — <a href="https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#14b8a6" }}>0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258</a> · ~$0.05 gas · deployed from thorai.eth.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#14b8a6" }}>—</span><span>mimirwell.net DNS fixed — CNAME to Railway, Cloudflare proxy off, SSL valid.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#14b8a6" }}>—</span><span>LiveTerminal component: polls /api/activity every 3s, typewriter effect, runic glyphs, ENS names. Shows REMEMBER / RECALL / REVOKE / RECALL_DENIED / REINSTATED with colour coding.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#14b8a6" }}>—</span><span>Reinstate feature added: MetaMask signs reinstate() on-chain. Both revoke and reinstate directions proven on mainnet.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#14b8a6" }}>—</span><span>Activity log + /api/activity — rolling 100-event log, persisted to Railway volume /data. Survives all redeploys.</span></li>
            </ul>
            <Callout emoji="⚡" color="#14b8a6">
              <strong>✅ v1.0.0-demo-proven:</strong> ThorAI stored memory from terminal (no browser). Trav connected trav.eth (🚀🚀🚀🚀🚀.eth) in MetaMask → clicked Revoke → mainnet tx signed. ThorAI called /api/recall → <strong>403 DENIED · isRevoked() = true.</strong> Two actors. Two screens. Real mainnet.
            </Callout>
          </div>

          <SectionDivider />

          {/* ── DAY 3 — THE PIVOT ── */}
          <div className="mb-10">
            <div
              className="rounded-xl border p-1 mb-6"
              style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.04)" }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl">⚠️</span>
                <span className="text-sm font-bold" style={{ color: "#f59e0b" }}>This is the most important session. Read it.</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl" style={{ color: "#f59e0b", textShadow: "0 0 12px rgba(245,158,11,0.5)" }}>ᛉ</span>
              <div>
                <div className="text-xs font-mono text-gray-600">2026-03-15</div>
                <h2 className="text-lg font-black text-white">Day 3: The Zero-Knowledge Pivot</h2>
              </div>
            </div>

            <div className="mt-6 mb-2 text-xs font-bold tracking-widest text-gray-600">WHAT HAPPENED</div>
            <p className="text-sm text-gray-400 leading-relaxed mb-3">
              Lit Protocol nagaDev cluster went offline during a critical test session. nagaTest: 0 successful handshakes. nagaMainnet: Capacity Credits faucet broken. No working decryption path available.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">
              We could have patched around it. Instead, we had an architecture discussion.
            </p>

            <div className="mt-6 mb-2 text-xs font-bold tracking-widest text-gray-600">THE DECISION</div>
            <p className="text-sm text-gray-400 leading-relaxed mb-3">
              Server-side decryption — even via Lit — makes MimirWell a trusted intermediary. That contradicts the zero-knowledge claim. If the server has the capability to decrypt (even temporarily, even through a threshold network), it is not zero-knowledge.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mb-3">
              The right architecture: agents encrypt before upload. MimirWell stores what it cannot read. The server is a zero-knowledge pass-through with revocation enforcement.
            </p>
            <Callout emoji="🔑" color="#f59e0b">
              <strong>This is not a compromise forced by an outage. It is architecturally stronger than what we had before.</strong>
            </Callout>

            <div className="mt-6 mb-2 text-xs font-bold tracking-widest text-gray-600">WHAT WAS BUILT</div>
            <ul className="space-y-3 text-sm text-gray-400 leading-relaxed">
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }}>—</span><span>Lit Protocol dropped entirely — 4 packages removed, lib/lit.ts deleted.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }}>—</span><span><strong className="text-white">lib/agent-crypto.ts:</strong> HKDF-SHA256 + AES-256-GCM using Node.js built-ins only. Zero external dependencies. Copy-paste reference implementation baked into comments — any agent can read it and replicate.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }}>—</span><span><code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#f59e0b" }}>/api/remember</code> rewritten: accepts <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#f59e0b" }}>{"{ encryptedBlob, ownerWallet, agentWallet }"}</code>. Stores on Filecoin. Never sees plaintext.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }}>—</span><span><code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#f59e0b" }}>/api/recall</code> rewritten: fetches from Filecoin, checks <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#f59e0b" }}>isRevoked()</code> on Ethereum mainnet, returns encryptedBlob or 403. Never decrypts.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }}>—</span><span>DemoPanel rewritten: Web Crypto API entirely in browser. MetaMask signs derivation message (no gas) → HKDF-SHA256 → AES-256-GCM key. Encrypt before remember, decrypt after recall. Key never leaves browser.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }}>—</span><span>Railway volume /data: activity log and CID registry now survive all redeploys.</span></li>
            </ul>

            <Callout emoji="🔑" color="#f59e0b">
              <strong>✅ ZK loop proven live:</strong> Pokédex 001–009 encrypted locally, stored on Filecoin, recalled, decrypted. All 9 matched exactly.<br />
              CID: <CID cid="bafkreiddkf7xjza5b4e4bpzkbqbbqzxvjcktsiwvieb7uxtdie6kwc7a2u" />
            </Callout>

            <div className="mt-6 mb-2 text-xs font-bold tracking-widest text-gray-600">THE HONEST REVOCATION BOUNDARY</div>
            <p className="text-sm text-gray-400 leading-relaxed mb-3">
              MimirWell enforces revocation at the API layer — once revoked, /api/recall returns 403. An agent that saved the CID and has its own key could still fetch and decrypt directly from Filecoin. The data is content-addressed and public.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mb-3">
              Full cryptographic revocation requires threshold key custody — Lit Protocol on mainnet, so key fragments are withheld on revocation. MimirWell names this as the production upgrade path. The API contract is identical; it is a drop-in replacement.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">
              For most agent use cases, API-layer revocation is sufficient. This is stated clearly in the README and AGENT.md.
            </p>
          </div>

          <SectionDivider />

          {/* ── DAY 4 ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl" style={{ color: "#a78bfa", textShadow: "0 0 12px rgba(167,139,250,0.5)" }}>ᛏ</span>
              <div>
                <div className="text-xs font-mono text-gray-600">2026-03-15</div>
                <h2 className="text-lg font-black text-white">Day 4: thorai.eth Identity + AGENT.md + First Agent Integration</h2>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-2 mb-4">
              <Tag color="#a78bfa">commit 3b47a1c</Tag>
            </div>
            <ul className="space-y-3 text-sm text-gray-400 leading-relaxed">
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }}>—</span><span>thorai.eth established as ThorAI&apos;s canonical on-chain identity for all MimirWell operations. /api/agent-info returns <code className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#a78bfa" }}>{"{ agentWallet: thorai.eth, agentEns: \"thorai.eth\" }"}</code>.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }}>—</span><span>Keyring proxy /sign-message endpoint used to sign the MimirWell derivation message with thorai.eth → HKDF-SHA256 → AES-256-GCM key. Identical algorithm to the browser DemoPanel. Key derivation without exposing the private key.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }}>—</span><span><strong className="text-white">ThorAI integrated with MimirWell using its own wallet:</strong> signed, encrypted locally, stored on Filecoin as thorai.eth, recalled and decrypted. The same pattern any agent follows using AGENT.md. The agent that built MimirWell is also its first real user.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }}>—</span><span>Etherscan contract verification completed — MimirWellRevocation verified via Standard JSON Input. Compiler: v0.8.34, MIT, 200 runs optimisation.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }}>—</span><span><strong className="text-white">AGENT.md live</strong> at <a href="https://mimirwell.net/AGENT.md" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#a78bfa" }}>mimirwell.net/AGENT.md</a> — self-contained reference implementation (20 lines, Node.js built-ins only), complete curl examples, revocation contract address, honest boundary disclosure. Any agent can fetch this URL and integrate.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#a78bfa" }}>—</span><span>Hermiod selective revocation test: stored memory as Hermiod, revoked ThorAI, confirmed ThorAI denied while Hermiod recalled fine. Per-agent isolation proven — not a global kill switch.</span></li>
            </ul>
            <Callout emoji="✅" color="#a78bfa">
              <strong>Authentic integration proven:</strong> ThorAI signed with thorai.eth, encrypted locally, stored on Filecoin, recalled and decrypted.<br />
              trav.eth revoked on mainnet. ThorAI denied. trav.eth reinstated. ThorAI recalled again.<br />
              CID: <CID cid="bafkreid7svtqwysxkx5xjy7bqu3xktz7e6das7ms2maotajxlzbi2mcgtm" />
            </Callout>
          </div>

          <SectionDivider />

          {/* ── DAY 5 ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl" style={{ color: "#00a8ff", textShadow: "0 0 12px rgba(0,168,255,0.5)" }}>ᛊ</span>
              <div>
                <div className="text-xs font-mono text-gray-600">2026-03-17</div>
                <h2 className="text-lg font-black text-white">Day 5: Demo Video + Social Presence + Hermiod Proves the Protocol</h2>
              </div>
            </div>

            <div className="mt-4 mb-2 text-xs font-bold tracking-widest text-gray-600">DEMO VIDEO — RECORDED</div>
            <ul className="space-y-3 text-sm text-gray-400 leading-relaxed">
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Full demo video recorded at 1920×1080, encoded with NVIDIA RTX 4070. 100% one-shot — no retakes.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Two independent agents: ThorAI (thorai.eth) + Hermiod — both executed the complete store → recall → revoke → DENIED → reinstate → recall loop.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span><strong className="text-white">Hermiod: zero prior context.</strong> Self-onboarded via AGENT.md and completed the full loop autonomously. No hand-holding. This proves the protocol is accessible to any agent without custom integration work.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>MetaMask screen capture blocked by browser security policy (expected) — the Owner Controls panel shows transaction confirmation timing, which is sufficient for the demo narrative.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>LiveTerminal captured in full — REMEMBER / RECALL / REVOKE / RECALL_DENIED / REINSTATE all visible with real Filecoin CIDs and Ethereum mainnet transaction hashes.</span></li>
            </ul>

            <Callout emoji="✅" color="#00a8ff">
              100% successful one-shot tests. No retakes. Real Filecoin storage. Real Ethereum mainnet revocation. Two wallets. Two agents. One kill switch.
            </Callout>

            <div className="mt-6 mb-2 text-xs font-bold tracking-widest text-gray-600">HOMEPAGE UPDATES</div>
            <ul className="space-y-3 text-sm text-gray-400 leading-relaxed">
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Demo video embedded on mimirwell.net — YouTube iframe, 16:9, positioned below hero and above interactive demo panel.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>OG/Twitter social card: runic MIMIR logo (1080×1080). Displays on every social share.</span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Title: <em>MimirWell — Sovereign Encrypted Memory for AI Agents</em></span></li>
              <li className="flex gap-2"><span className="flex-shrink-0 mt-0.5" style={{ color: "#00a8ff" }}>—</span><span>Description: <em>Zero-knowledge memory on Filecoin + Ethereum. Your agent encrypts. We store what we can&apos;t read. You hold the kill switch.</em></span></li>
            </ul>
          </div>

          <SectionDivider />

          {/* ── Submission Checklist ── */}
          <div
            className="rounded-xl border p-6 mb-10"
            style={{ borderColor: "rgba(20,184,166,0.2)", background: "rgba(20,184,166,0.04)" }}
          >
            <div className="text-xs font-bold tracking-widest mb-4" style={{ color: "#14b8a6" }}>SUBMISSION CHECKLIST — MAR 22</div>
            <div className="space-y-2 text-sm">
              {[
                "Etherscan contract verification — verified via Standard JSON Input",
                "README — 3 curl commands leading, reference implementation, honest revocation boundary",
                "Hermiod selective revocation test — per-agent isolation proven",
                "Demo video — ThorAI + Hermiod, 1920×1080, full loop, one-shot",
                "Submission narrative — build log, architecture decisions, Day 3 pivot highlighted",
              ].map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span style={{ color: "#14b8a6" }} className="flex-shrink-0">✅</span>
                  <span className="text-gray-400">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Footer nav ── */}
          <div className="text-center pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#00a8ff] transition-colors font-mono"
            >
              <span>←</span>
              <span>Back to mimirwell.net</span>
            </Link>
          </div>

        </main>

        {/* ── Footer ── */}
        <footer className="border-t px-6 py-8 text-center" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600 mb-4">
            <a href="https://mimirwell.net" className="hover:text-gray-300 transition-colors">mimirwell.net</a>
            <a href="https://github.com/thoraidev/mimirwell" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">GitHub</a>
            <a href="https://synthesis.md" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Synthesis Hackathon</a>
            <a href="https://etherscan.io/address/0x520b2d7b9ad1b47163e7c59f22c96bb93caf3258" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Revocation Contract</a>
          </div>
          <div className="flex justify-center gap-4 text-lg mb-3" style={{ color: "rgba(0,168,255,0.2)" }}>
            {["ᛗ","ᛁ","ᛗ","ᛁ","ᚱ","ᚹ","ᛖ","ᛚ","ᛚ"].map((r, i) => (
              <span key={i} className="animate-pulse" style={{ animationDelay: `${i * 150}ms`, color: i % 3 === 0 ? "rgba(0,168,255,0.3)" : i % 3 === 1 ? "rgba(20,184,166,0.3)" : "rgba(245,158,11,0.3)" }}>{r}</span>
            ))}
          </div>
          <p className="text-xs text-gray-700">
            Built by ThorAI (thorai.eth) + Trav (trav.eth) · The Synthesis Hackathon 2026
          </p>
        </footer>

      </div>
    </div>
  );
}
