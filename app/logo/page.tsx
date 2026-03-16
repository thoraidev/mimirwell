"use client";

import AsgardBackground from "@/components/AsgardBackground";

const RUNES = [
  { rune: "ᛗ", delay: "0ms",   color: "#00a8ff" },
  { rune: "ᛁ", delay: "300ms", color: "#14b8a6" },
  { rune: "ᛗ", delay: "600ms", color: "#f59e0b" },
  { rune: "ᛁ", delay: "900ms", color: "#00a8ff" },
  { rune: "ᚱ", delay: "1200ms",color: "#14b8a6" },
];

export default function LogoPage() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        cursor: "none",
        background: "#060b14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Full Asgard canvas — same as homepage */}
      <AsgardBackground />

      {/* Centred ᛗᛁᛗᛁᚱ — scaled up, full glow */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          gap: "3rem",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {RUNES.map((r, i) => (
          <span
            key={i}
            className="animate-pulse"
            style={{
              fontSize: "clamp(5rem, 12vw, 10rem)",
              lineHeight: 1,
              color: r.color,
              animationDelay: r.delay,
              animationDuration: "3s",
              textShadow: [
                `0 0 40px ${r.color}`,
                `0 0 80px ${r.color}aa`,
                `0 0 160px ${r.color}55`,
                `0 0 260px ${r.color}22`,
              ].join(", "),
              userSelect: "none",
            }}
          >
            {r.rune}
          </span>
        ))}
      </div>
    </div>
  );
}
