"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ActivityEvent {
  id: string;
  ts: string;
  type: "REMEMBER" | "RECALL" | "RECALL_DENIED" | "REVOKE" | "REINSTATED";
  agentWallet: string;
  ownerWallet?: string;
  cid?: string;
  cipher?: string;
  txHash?: string;
  success: boolean;
}

const RUNE: Record<string, string> = {
  REMEMBER: "ᚠ",
  RECALL: "ᛖ",
  RECALL_DENIED: "ᛉ",
  REVOKE: "ᛉ",
  REINSTATED: "ᚱ",
};

const COLOR: Record<string, string> = {
  REMEMBER: "#00a8ff",
  RECALL: "#14b8a6",
  RECALL_DENIED: "#ef4444",
  REVOKE: "#f59e0b",
  REINSTATED: "#a78bfa",
};

function renderLines(event: ActivityEvent): { text: string; color?: string }[] {
  const rune = RUNE[event.type] ?? "ᛟ";
  const color = COLOR[event.type] ?? "#9ca3af";
  const lines: { text: string; color?: string }[] = [];

  switch (event.type) {
    case "REMEMBER":
      lines.push({ text: `[${event.ts}] ${rune} REMEMBER  ${event.agentWallet} → Filecoin ✓`, color });
      if (event.cipher) lines.push({ text: `           ENCRYPT  ${event.cipher}…`, color: "#4b5563" });
      if (event.cid)    lines.push({ text: `           CID      ${event.cid}`, color: "#374151" });
      break;

    case "RECALL":
      lines.push({ text: `[${event.ts}] ${rune} RECALL    ${event.agentWallet}`, color });
      if (event.cid)    lines.push({ text: `           CID      ${event.cid}`, color: "#374151" });
      lines.push({ text: `           DECRYPT  ✓  [plaintext sealed — agent eyes only]`, color: "#14b8a6" });
      break;

    case "RECALL_DENIED":
      lines.push({ text: `[${event.ts}] ${rune} RECALL    ${event.agentWallet}  ← DENIED`, color });
      lines.push({ text: `           LIT      isRevoked() = true  [access sealed]`, color: "#ef4444" });
      break;

    case "REVOKE":
      lines.push({
        text: `[${event.ts}] ${rune} REVOKE    ${event.ownerWallet ?? "owner"} → sealed ${event.agentWallet}`,
        color,
      });
      if (event.txHash) lines.push({ text: `           CHAIN    tx ${event.txHash} confirmed`, color: "#6b7280" });
      break;

    case "REINSTATED":
      lines.push({ text: `[${event.ts}] ${rune} REINSTATE ${event.ownerWallet ?? "owner"} → unlocked ${event.agentWallet}`, color });
      break;
  }

  return lines;
}

interface TerminalLine {
  key: string;
  text: string;
  color?: string;
  visible: string; // current visible portion (typewriter)
  done: boolean;
}

const TYPEWRITER_MS = 18; // ms per character
const POLL_INTERVAL = 3000;
const MAX_LINES = 60;

export default function LiveTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineQueueRef = useRef<TerminalLine[]>([]);
  const typingRef = useRef(false);

  // Scroll to bottom when lines update
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Typewriter engine — processes one line at a time from the queue
  const runTypewriter = useCallback(() => {
    if (typingRef.current) return;
    if (lineQueueRef.current.length === 0) return;

    typingRef.current = true;
    const line = lineQueueRef.current.shift()!;

    // Add the line with empty visible text
    setLines(prev => {
      const next = [...prev, { ...line, visible: "", done: false }];
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
    });

    let i = 0;
    const fullText = line.text;

    const tick = () => {
      i++;
      const slice = fullText.slice(0, i);
      setLines(prev =>
        prev.map(l => l.key === line.key ? { ...l, visible: slice, done: i >= fullText.length } : l)
      );

      if (i < fullText.length) {
        setTimeout(tick, TYPEWRITER_MS);
      } else {
        typingRef.current = false;
        // Process next line immediately
        runTypewriter();
      }
    };

    setTimeout(tick, TYPEWRITER_MS);
  }, []);

  // Poll /api/activity
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch("/api/activity");
        if (!res.ok) return;
        const { events }: { events: ActivityEvent[] } = await res.json();

        const newEvents = events.filter(e => !seenIds.has(e.id));
        if (newEvents.length > 0) {
          const newIds = new Set(seenIds);
          const newLines: TerminalLine[] = [];

          for (const event of newEvents) {
            newIds.add(event.id);
            const rendered = renderLines(event);
            rendered.forEach((rl, i) => {
              newLines.push({
                key: `${event.id}-${i}`,
                text: rl.text,
                color: rl.color,
                visible: "",
                done: false,
              });
            });
            // Blank separator line
            newLines.push({ key: `${event.id}-sep`, text: "", color: undefined, visible: "", done: true });
          }

          setSeenIds(newIds);
          lineQueueRef.current.push(...newLines);
          runTypewriter();
        }
      } catch {
        // Non-fatal
      } finally {
        if (active) timer = setTimeout(poll, POLL_INTERVAL);
      }
    }

    poll();
    return () => {
      clearTimeout(timer);
      setActive(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = lines.length === 0;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "rgba(0,168,255,0.12)", background: "rgba(0,0,0,0.6)" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: "rgba(0,168,255,0.1)", background: "rgba(0,168,255,0.04)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "#00a8ff", boxShadow: "0 0 6px #00a8ff" }}
          />
          <span className="text-xs font-mono font-bold" style={{ color: "#00a8ff" }}>
            ● LIVE MimirWell Activity
          </span>
        </div>
        <span className="text-xs font-mono text-gray-600">
          {lines.filter(l => l.text).length} events
        </span>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="overflow-y-auto font-mono text-xs leading-relaxed p-4"
        style={{ height: "320px", color: "#9ca3af" }}
      >
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-700">
            <span className="text-2xl animate-pulse" style={{ color: "rgba(0,168,255,0.2)" }}>ᛟ</span>
            <span className="text-xs">Waiting for activity…</span>
            <span className="text-xs opacity-50">Try the demo above to see live events</span>
          </div>
        ) : (
          lines.map(line => (
            <div
              key={line.key}
              className="whitespace-pre"
              style={{ color: line.color ?? "#4b5563", minHeight: "1.25rem" }}
            >
              {line.visible}
              {!line.done && line.text && (
                <span
                  className="inline-block w-1.5 h-3.5 ml-0.5 align-middle animate-pulse"
                  style={{ background: line.color ?? "#4b5563" }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
