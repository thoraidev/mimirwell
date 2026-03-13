"use client";

import { useEffect, useRef } from "react";

// Rune glyphs drawn from Elder Futhark + decorative symbols
const RUNES = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", "ᛁ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛊ", "ᛏ", "ᛒ", "ᛖ", "ᛗ", "ᛚ", "ᛜ", "ᛞ", "ᛟ"];

interface RuneParticle {
  x: number;
  y: number;
  glyph: string;
  opacity: number;
  speed: number;
  size: number;
  phase: number;
  color: string;
}

const RUNE_COLORS = ["#00a8ff", "#14b8a6", "#f59e0b", "#3b82f6"];

export default function AsgardBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runesRef = useRef<RuneParticle[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn rune particles
    const spawnRunes = () => {
      runesRef.current = Array.from({ length: 40 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        glyph: RUNES[Math.floor(Math.random() * RUNES.length)],
        opacity: Math.random() * 0.4 + 0.05,
        speed: Math.random() * 0.3 + 0.05,
        size: Math.random() * 18 + 10,
        phase: Math.random() * Math.PI * 2,
        color: RUNE_COLORS[Math.floor(Math.random() * RUNE_COLORS.length)],
      }));
    };
    spawnRunes();

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Gradient background
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#060b14");
      grad.addColorStop(0.5, "#0a0f1a");
      grad.addColorStop(1, "#060c18");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle grid lines (Asgard energy field)
      ctx.strokeStyle = "rgba(0, 168, 255, 0.04)";
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let gx = 0; gx < canvas.width; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, canvas.height);
        ctx.stroke();
      }
      for (let gy = 0; gy < canvas.height; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(canvas.width, gy);
        ctx.stroke();
      }

      // Animate runes
      runesRef.current.forEach((rune) => {
        rune.y -= rune.speed;
        if (rune.y < -40) {
          rune.y = canvas.height + 20;
          rune.x = Math.random() * canvas.width;
          rune.glyph = RUNES[Math.floor(Math.random() * RUNES.length)];
        }

        const pulse = Math.sin(t * 0.02 + rune.phase);
        const alpha = rune.opacity * (0.6 + 0.4 * pulse);
        const scale = 1 + 0.1 * pulse;

        ctx.save();
        ctx.translate(rune.x, rune.y);
        ctx.scale(scale, scale);
        ctx.font = `${rune.size}px serif`;
        ctx.fillStyle = rune.color;
        ctx.globalAlpha = alpha;

        // Glow
        ctx.shadowColor = rune.color;
        ctx.shadowBlur = 8 + 6 * Math.abs(pulse);

        ctx.fillText(rune.glyph, 0, 0);
        ctx.restore();
      });

      t++;
      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden
    />
  );
}
