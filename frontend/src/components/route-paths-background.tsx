"use client";

import { useEffect, useRef, useState } from "react";

const SEED = 42069;

interface Orb {
  pathIdx: number;
  speed: number;
  offset: number;
  radius: number;
  hue: number;
}

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

/**
 * Simple path definitions. Each path is:
 *   from: [x, y]  — start point (0-1 normalized)
 *   to:   [x, y]  — end point (0-1 normalized)
 *   bend: number   — how much the curve bends perpendicular to the line (-1 to 1)
 *                    positive = bend left (relative to direction), negative = bend right
 *
 * Easy to edit: just move the start/end points and adjust bend.
 */
const PATHS: { from: [number, number]; to: [number, number]; bend: number; color: string }[] = [
  // RED — Large arc from upper-left area sweeping down to bottom-center
  { from: [0.35, 0], to: [0, .5], bend: -0.2, color: "#ff0000" },

  // GREEN — Enters top ~15%, sweeps right and exits right side ~30%
  { from: [0, .8], to: [.8, .1], bend: -0.2, color: "#00ff00" },

  // BLUE — Big sweep from top-center down through right side
  // { from: [0.40, 0], to: [1, 0.65], bend: -0.4, color: "#0088ff" },

  // YELLOW — Enters left ~60%, gentle arc exits bottom ~25%
  // { from: [0, 0.55], to: [0.25, 1], bend: 0.3, color: "#ffff00" },

  // MAGENTA — Enters top-right, curves down-left, exits bottom-right
  { from: [1, .2], to: [1, 1], bend: 0.3, color: "#ff00ff" },

  // CYAN — Wide arc from left ~85% to right ~50%
  { from: [.9, .1], to: [.6, 1], bend: .2, color: "#00ffff" },

  // ORANGE — Short curve top-right corner
  // { from: [1,.1], to: [.9, 1], bend: 1.2, color: "#ff8800" },

  // LIME — Curve from bottom-left to bottom-right
  { from: [0.10, 1], to: [0.5, 1], bend: -1.6, color: "#88ff00" },
];

/** Build a quadratic bezier from start, end, and bend amount */
function buildPath(
  from: [number, number],
  to: [number, number],
  bend: number,
  w: number,
  h: number,
  segments = 80,
): [number, number][] {
  // Midpoint
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;

  // Direction vector and perpendicular
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular (rotated 90 degrees)
  const px = -dy / len;
  const py = dx / len;

  // Control point offset by bend amount * path length
  const cpx = mx + px * bend * len;
  const cpy = my + py * bend * len;

  // Sample quadratic bezier
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const x = u * u * from[0] + 2 * u * t * cpx + t * t * to[0];
    const y = u * u * from[1] + 2 * u * t * cpy + t * t * to[1];
    points.push([x * w, y * h]);
  }
  return points;
}

function polylineLengths(points: [number, number][]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return lengths;
}

function samplePolyline(
  points: [number, number][],
  lengths: number[],
  dist: number,
): [number, number] {
  const total = lengths[lengths.length - 1];
  const d = ((dist % total) + total) % total;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < d) i++;
  const segLen = lengths[i] - lengths[i - 1];
  const t = segLen === 0 ? 0 : (d - lengths[i - 1]) / segLen;
  return [
    points[i - 1][0] + t * (points[i][0] - points[i - 1][0]),
    points[i - 1][1] + t * (points[i][1] - points[i - 1][1]),
  ];
}

export function RoutePathsBackground({
  seed = SEED,
  className = "absolute inset-0 h-full w-full",
  variant = "light",
}: {
  seed?: number;
  className?: string;
  variant?: "light" | "dark";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => {
      const rect = canvas.getBoundingClientRect();
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;

    const dpr = window.devicePixelRatio || 1;
    const w = size.w;
    const h = size.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Build paths
    const pathData = PATHS.map((p) => {
      const points = buildPath(p.from, p.to, p.bend, w, h);
      const lengths = polylineLengths(points);
      return { points, lengths, total: lengths[lengths.length - 1], color: p.color };
    });

    // Draw static paths
    const staticCanvas = document.createElement("canvas");
    staticCanvas.width = w * dpr;
    staticCanvas.height = h * dpr;
    const sctx = staticCanvas.getContext("2d")!;
    sctx.scale(dpr, dpr);

    // Paths are invisible — only orbs are drawn
    void pathData;

    // Create orbs
    const rand = seededRng(seed + 777);
    const orbs: Orb[] = pathData.map((pd, i) => ({
      pathIdx: i,
      speed: 5 + rand() * 30,
      offset: rand() * pd.total,
      radius: 2.5 + rand() * 1.5,
      hue: rand() < 0.5 ? 270 : 330,
    }));

    // Fade in
    canvas.style.opacity = "0";
    canvas.style.transition = "opacity 0.5s ease-in";
    requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    let animId: number;
    let lastTime = 0;

    const animate = (time: number) => {
      const dt = lastTime === 0 ? 16 : time - lastTime;
      lastTime = time;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(staticCanvas, 0, 0, w, h);

      for (const orb of orbs) {
        const pd = pathData[orb.pathIdx];
        orb.offset = (orb.offset + orb.speed * (dt / 1000)) % pd.total;

        const [px, py] = samplePolyline(pd.points, pd.lengths, orb.offset);

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, orb.radius * 6);
        gradient.addColorStop(0, "rgba(71, 255, 216, 0.5)");
        gradient.addColorStop(0.4, "rgba(71, 255, 216, 0.2)");
        gradient.addColorStop(1, "rgba(71, 255, 216, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, orb.radius * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(71, 255, 216, 0.95)";
        ctx.beginPath();
        ctx.arc(px, py, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, seed, variant, JSON.stringify(PATHS)]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ opacity: 0 }}
      aria-hidden="true"
    />
  );
}
