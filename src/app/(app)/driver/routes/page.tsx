// src/app/(app)/driver/routes/page.tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DriverRoutesView } from "@/features/driver/routes/views/DriverRoutesView";
import { AlertMatchesPanel } from "@/features/alerts/components/AlertMatchesPanel";

function DriverRoutesPageContents() {
  const searchParams = useSearchParams();
  const expandMatches = searchParams.get("matches") === "1";

  return (
    <div className="flex flex-col gap-4">
      <AlertMatchesPanel defaultExpanded={expandMatches} />
      <DriverRoutesView />
    </div>
  );
}

export default function DriverRoutesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <DriverRoutesPageContents />
    </Suspense>
  );
}
