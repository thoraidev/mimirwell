"use client";

import AsgardBackground from "@/components/AsgardBackground";

export default function LogoBgPage() {
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
      {/* Pure Asgard canvas — no overlay content */}
      <AsgardBackground />
    </div>
  );
}
