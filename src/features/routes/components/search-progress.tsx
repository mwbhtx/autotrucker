"use client";

import type { SearchProgress } from "@/core/hooks/use-routes";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Props {
  progress: SearchProgress | null;
  elapsedMs: number;
  onCancel: () => void;
  variant: "desktop" | "mobile";
}

export function SearchProgressBar({ progress, elapsedMs, onCancel, variant }: Props) {
  const phase: "starting" | "filtering" | "analyzing" = !progress
    ? "starting"
    : progress.survivors_total > 0
      ? "analyzing"
      : progress.pairs_total > 0
        ? "filtering"
        : "starting";

  const percent =
    phase === "analyzing" && progress
      ? Math.min(100, (progress.pairs_simulated / Math.max(1, progress.survivors_total)) * 100)
      : 0;

  const label = (() => {
    if (phase === "starting") return "Starting search…";
    if (phase === "filtering") return "Filtering candidates…";
    if (progress) {
      return `Analyzing ${progress.pairs_simulated.toLocaleString()} / ${progress.survivors_total.toLocaleString()} routes`;
    }
    return "Working…";
  })();

  const routesFound = progress?.routes_found ?? 0;
  const elapsed = formatElapsed(elapsedMs);

  const bar = (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      {phase === "analyzing" ? (
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      ) : (
        <div className="h-full w-1/3 bg-primary rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
      )}
    </div>
  );

  const spinner = (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  if (variant === "desktop") {
    return (
      <div className="px-4 pt-3 pb-1 space-y-1.5">
        {bar}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums">· {elapsed}</span>
          {routesFound > 0 && (
            <span className="text-primary">· {routesFound} match{routesFound === 1 ? "" : "es"}</span>
          )}
        </div>
        <button
          onClick={onCancel}
          className="mt-2 mx-auto flex h-9 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:brightness-110 transition-all"
        >
          {spinner}
          Cancel Search
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-1 pb-2 space-y-1.5">
      {bar}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <span className="truncate">{label}</span>
          <span className="tabular-nums shrink-0">· {elapsed}</span>
          {routesFound > 0 && (
            <span className="text-primary shrink-0">· {routesFound}</span>
          )}
        </div>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shrink-0"
        >
          {spinner}
          Cancel
        </button>
      </div>
    </div>
  );
}
