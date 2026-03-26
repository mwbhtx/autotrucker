"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

interface Beam {
  d: string;
  duration: number;
  delay: number;
  width: number;
  opacity: number;
}

function generateBeams(count: number, seed = 42): Beam[] {
  const rand = seededRandom(seed);
  const beams: Beam[] = [];

  for (let i = 0; i < count; i++) {
    // Random start and end points along edges
    const startEdge = rand() < 0.5 ? "left" : "top";
    const endEdge = rand() < 0.5 ? "right" : "bottom";

    let x0: number, y0: number, x1: number, y1: number;

    if (startEdge === "left") {
      x0 = -5;
      y0 = rand() * 100;
    } else {
      x0 = rand() * 100;
      y0 = -5;
    }

    if (endEdge === "right") {
      x1 = 105;
      y1 = rand() * 100;
    } else {
      x1 = rand() * 100;
      y1 = 105;
    }

    // Curved path with random control points
    const cx = x0 + (x1 - x0) * (0.3 + rand() * 0.4) + (rand() - 0.5) * 40;
    const cy = y0 + (y1 - y0) * (0.3 + rand() * 0.4) + (rand() - 0.5) * 40;

    beams.push({
      d: `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`,
      duration: 4 + rand() * 6,
      delay: rand() * -10,
      width: 0.5 + rand() * 1.5,
      opacity: 0.15 + rand() * 0.25,
    });
  }

  return beams;
}

export function BackgroundBeams({
  className,
  beamCount = 12,
}: {
  className?: string;
  beamCount?: number;
}) {
  const beams = useRef(generateBeams(beamCount)).current;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="beam-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff5005" stopOpacity="0" />
            <stop offset="30%" stopColor="#ff5005" stopOpacity="1" />
            <stop offset="70%" stopColor="#dbba95" stopOpacity="1" />
            <stop offset="100%" stopColor="#e1a194" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="beam-gradient-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e1a194" stopOpacity="0" />
            <stop offset="30%" stopColor="#dbba95" stopOpacity="1" />
            <stop offset="70%" stopColor="#ff5005" stopOpacity="1" />
            <stop offset="100%" stopColor="#ff5005" stopOpacity="0" />
          </linearGradient>
        </defs>

        {beams.map((beam, i) => (
          <path
            key={i}
            d={beam.d}
            stroke={`url(#beam-gradient-${(i % 2) + 1})`}
            strokeWidth={beam.width}
            strokeOpacity={beam.opacity}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="200"
              to="-200"
              dur={`${beam.duration}s`}
              begin={`${beam.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-dasharray"
              values="0 400;80 320;0 400"
              dur={`${beam.duration}s`}
              begin={`${beam.delay}s`}
              repeatCount="indefinite"
            />
          </path>
        ))}
      </svg>
    </div>
  );
}
