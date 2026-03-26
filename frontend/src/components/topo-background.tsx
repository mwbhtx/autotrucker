"use client";

import { useEffect, useRef, useState } from "react";

// Simplex noise implementation (2D)
class SimplexNoise {
  private perm: Uint8Array;
  private grad2 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];

  constructor(seed: number) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      const g = this.grad2[this.perm[ii + this.perm[jj]] % 8];
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      const g = this.grad2[this.perm[ii + i1 + this.perm[jj + j1]] % 8];
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      const g = this.grad2[this.perm[ii + 1 + this.perm[jj + 1]] % 8];
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }
}

// Marching squares: extract contour line segments for a given threshold
function marchingSquares(
  field: Float64Array,
  w: number,
  h: number,
  threshold: number,
): [number, number, number, number][] {
  const segments: [number, number, number, number][] = [];

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const tl = field[y * w + x];
      const tr = field[y * w + x + 1];
      const br = field[(y + 1) * w + x + 1];
      const bl = field[(y + 1) * w + x];

      const idx =
        (tl >= threshold ? 8 : 0) |
        (tr >= threshold ? 4 : 0) |
        (br >= threshold ? 2 : 0) |
        (bl >= threshold ? 1 : 0);

      if (idx === 0 || idx === 15) continue;

      const lerp = (a: number, b: number) => {
        const d = b - a;
        return d === 0 ? 0.5 : (threshold - a) / d;
      };

      const top: [number, number] = [x + lerp(tl, tr), y];
      const right: [number, number] = [x + 1, y + lerp(tr, br)];
      const bottom: [number, number] = [x + lerp(bl, br), y + 1];
      const left: [number, number] = [x, y + lerp(tl, bl)];

      const add = (a: [number, number], b: [number, number]) =>
        segments.push([a[0], a[1], b[0], b[1]]);

      switch (idx) {
        case 1: case 14: add(left, bottom); break;
        case 2: case 13: add(bottom, right); break;
        case 3: case 12: add(left, right); break;
        case 4: case 11: add(top, right); break;
        case 5: add(left, top); add(bottom, right); break;
        case 6: case 9: add(top, bottom); break;
        case 7: case 8: add(left, top); break;
        case 10: add(top, right); add(left, bottom); break;
      }
    }
  }
  return segments;
}

// Spatial hash key for a point (snap to grid for fast neighbor lookup)
function pointKey(x: number, y: number): string {
  return `${(x * 100) | 0},${(y * 100) | 0}`;
}

// Chain segments into continuous polylines using spatial hashing (O(n) vs O(n^2))
function chainSegments(
  segments: [number, number, number, number][],
  scale: number,
): number[][][] {
  if (segments.length === 0) return [];

  // Build endpoint index: map point-key -> list of { segIdx, endIdx (0 or 1) }
  type EndRef = { segIdx: number; endIdx: number };
  const index = new Map<string, EndRef[]>();
  const pts: number[][][] = segments.map(([x1, y1, x2, y2]) => [
    [x1 * scale, y1 * scale],
    [x2 * scale, y2 * scale],
  ]);

  for (let i = 0; i < pts.length; i++) {
    for (let e = 0; e < 2; e++) {
      const k = pointKey(pts[i][e][0], pts[i][e][1]);
      let list = index.get(k);
      if (!list) { list = []; index.set(k, list); }
      list.push({ segIdx: i, endIdx: e });
    }
  }

  const used = new Uint8Array(segments.length);
  const chains: number[][][] = [];

  const findNeighbor = (px: number, py: number, exclude: number): EndRef | null => {
    const k = pointKey(px, py);
    const list = index.get(k);
    if (!list) return null;
    for (const ref of list) {
      if (ref.segIdx === exclude || used[ref.segIdx]) continue;
      const p = pts[ref.segIdx][ref.endIdx];
      if (Math.abs(p[0] - px) < 0.5 && Math.abs(p[1] - py) < 0.5) return ref;
    }
    return null;
  };

  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = 1;
    const chain: number[][] = [pts[start][0], pts[start][1]];

    // Extend forward
    let lastSeg = start;
    while (true) {
      const tail = chain[chain.length - 1];
      const nb = findNeighbor(tail[0], tail[1], lastSeg);
      if (!nb) break;
      used[nb.segIdx] = 1;
      chain.push(pts[nb.segIdx][1 - nb.endIdx]);
      lastSeg = nb.segIdx;
    }

    // Extend backward
    lastSeg = start;
    while (true) {
      const head = chain[0];
      const nb = findNeighbor(head[0], head[1], lastSeg);
      if (!nb) break;
      used[nb.segIdx] = 1;
      chain.unshift(pts[nb.segIdx][1 - nb.endIdx]);
      lastSeg = nb.segIdx;
    }

    chains.push(chain);
  }

  return chains;
}

// Compute cumulative distances along a polyline
function cumulativeLengths(chain: number[][]): number[] {
  const lengths = [0];
  for (let i = 1; i < chain.length; i++) {
    const dx = chain[i][0] - chain[i - 1][0];
    const dy = chain[i][1] - chain[i - 1][1];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return lengths;
}

// Get position along a polyline at a given distance
function positionAtDistance(
  chain: number[][],
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
    chain[i - 1][0] + t * (chain[i][0] - chain[i - 1][0]),
    chain[i - 1][1] + t * (chain[i][1] - chain[i - 1][1]),
  ];
}

interface Dot {
  chainIdx: number;
  speed: number;
  offset: number;
  radius: number;
  hue: number;
}

// Fixed seed so every visitor sees the same terrain
const SEED = 42069;

export function TopoBackground({ seed = SEED, className = "absolute inset-0 h-full w-full", animated = true }: { seed?: number; className?: string; animated?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Track container size so the canvas re-renders on resize
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

    // Generate noise field at reduced resolution
    const scale = 8;
    const cols = Math.ceil(w / scale) + 1;
    const rows = Math.ceil(h / scale) + 1;
    const field = new Float64Array(cols * rows);

    const simplex = new SimplexNoise(seed);
    const freq1 = 0.004;
    const freq2 = 0.008;
    const freq3 = 0.002;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * scale;
        const py = y * scale;
        field[y * cols + x] =
          simplex.noise2D(px * freq1, py * freq1) * 0.6 +
          simplex.noise2D(px * freq2 + 100, py * freq2 + 100) * 0.3 +
          simplex.noise2D(px * freq3 + 200, py * freq3 + 200) * 0.1;
      }
    }

    // Build contour data with reduced count
    const numContours = 6;
    const allChains: { chain: number[][]; lengths: number[]; isMajor: boolean }[] = [];

    for (let i = 0; i < numContours; i++) {
      const threshold = -0.8 + (i / numContours) * 1.6;
      const segments = marchingSquares(field, cols, rows, threshold);
      const chains = chainSegments(segments, scale);
      const isMajor = i % 3 === 0;

      for (const chain of chains) {
        const lengths = cumulativeLengths(chain);
        const totalLen = lengths[lengths.length - 1];
        if (totalLen > 40) {
          allChains.push({ chain, lengths, isMajor });
        }
      }
    }

    // Draw static contour lines to an offscreen canvas
    const staticCanvas = document.createElement("canvas");
    staticCanvas.width = w * dpr;
    staticCanvas.height = h * dpr;
    const sctx = staticCanvas.getContext("2d")!;
    sctx.scale(dpr, dpr);

    for (const { chain, isMajor } of allChains) {
      sctx.strokeStyle = isMajor
        ? "rgba(255, 255, 255, 0.12)"
        : "rgba(255, 255, 255, 0.06)";
      sctx.lineWidth = isMajor ? 1.2 : 0.7;
      sctx.beginPath();
      sctx.moveTo(chain[0][0], chain[0][1]);
      for (let j = 1; j < chain.length; j++) {
        sctx.lineTo(chain[j][0], chain[j][1]);
      }
      sctx.stroke();
    }

    // Fade in once ready
    canvas.style.opacity = "0";
    canvas.style.transition = "opacity 0.5s ease-in";
    requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    if (!animated) {
      // Static only — just draw the contour lines
      ctx.drawImage(staticCanvas, 0, 0, w, h);
      return;
    }

    // Pick chains for animated dots
    const eligible = allChains
      .map((c, i) => ({ idx: i, len: c.lengths[c.lengths.length - 1], isMajor: c.isMajor }))
      .filter((c) => c.len > 100)
      .sort((a, b) => b.len - a.len);

    const dotCount = Math.min(Math.max(12, Math.floor(eligible.length * 0.15)), 30);
    const dots: Dot[] = [];

    // Seeded random for dot placement so it's deterministic too
    let rng = seed;
    const seededRandom = () => {
      rng = (rng * 16807 + 0) % 2147483647;
      return (rng & 0x7fffffff) / 0x7fffffff;
    };

    for (let i = 0; i < dotCount && i < eligible.length; i++) {
      const pick = eligible[i % eligible.length];
      dots.push({
        chainIdx: pick.idx,
        speed: 15 + seededRandom() * 25,
        offset: seededRandom() * pick.len,
        radius: 1.5 + seededRandom() * 1,
        hue: seededRandom() < 0.5 ? 270 : 330,
      });
    }

    // Animation loop
    let animId: number;
    let lastTime = 0;

    const animate = (time: number) => {
      const dt = lastTime === 0 ? 16 : time - lastTime;
      lastTime = time;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(staticCanvas, 0, 0, w, h);

      for (const dot of dots) {
        const { chain, lengths } = allChains[dot.chainIdx];
        const totalLen = lengths[lengths.length - 1];
        dot.offset = (dot.offset + dot.speed * (dt / 1000)) % totalLen;

        const [px, py] = positionAtDistance(chain, lengths, dot.offset);

        const gradient = ctx.createRadialGradient(px, py, 0, px, py, dot.radius * 6);
        gradient.addColorStop(0, `hsla(${dot.hue}, 80%, 70%, 0.4)`);
        gradient.addColorStop(0.4, `hsla(${dot.hue}, 80%, 60%, 0.15)`);
        gradient.addColorStop(1, `hsla(${dot.hue}, 80%, 50%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, dot.radius * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${dot.hue}, 90%, 80%, 0.9)`;
        ctx.beginPath();
        ctx.arc(px, py, dot.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [size, seed, animated]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ opacity: 0 }}
      aria-hidden="true"
    />
  );
}
