"use client";

import { useEffect, useRef, useState } from "react";
import AsgardBackground from "@/components/AsgardBackground";

const CHARS_PER_TICK = 8;   // speed — tweak up/down to taste
const TICK_MS        = 16;  // ~60fps
const LOOP_PAUSE_MS  = 1200; // pause before restart

export default function TerminalPage() {
  const [displayedText, setDisplayedText] = useState("");
  const [content, setContent]             = useState("");
  const indexRef    = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch AGENT.md once
  useEffect(() => {
    fetch("/AGENT.md")
      .then((r) => r.text())
      .then((text) => setContent(text))
      .catch(() => setContent("# AGENT.md\n\nFailed to load."));
  }, []);

  // Typewriter loop
  useEffect(() => {
    if (!content) return;

    const tick = () => {
      const end = Math.min(indexRef.current + CHARS_PER_TICK, content.length);
      setDisplayedText(content.slice(0, end));
      indexRef.current = end;

      if (end >= content.length) {
        // Pause then loop
        clearInterval(intervalRef.current!);
        setTimeout(() => {
          indexRef.current = 0;
          setDisplayedText("");
          intervalRef.current = setInterval(tick, TICK_MS);
        }, LOOP_PAUSE_MS);
      }
    };

    intervalRef.current = setInterval(tick, TICK_MS);
    return () => clearInterval(intervalRef.current!);
  }, [content]);

  // Auto-scroll to bottom as text grows
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayedText]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        cursor: "none",
        background: "#060b14",
        position: "relative",
      }}
    >
      {/* Asgard rune canvas */}
      <AsgardBackground />

      {/* Terminal text layer */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          padding: "2.5rem",
          overflowY: "hidden",
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "0.72rem",
          lineHeight: "1.6",
          color: "#14b8a6",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          textShadow: "0 0 8px rgba(20,184,166,0.6), 0 0 20px rgba(20,184,166,0.2)",
        }}
      >
        {displayedText}
        {/* Blinking block cursor */}
        <span
          className="animate-pulse"
          style={{
            display: "inline-block",
            width: "0.55em",
            height: "1em",
            background: "#14b8a6",
            verticalAlign: "text-bottom",
            marginLeft: "1px",
            boxShadow: "0 0 8px rgba(20,184,166,0.8)",
          }}
        />
      </div>
    </div>
  );
}
