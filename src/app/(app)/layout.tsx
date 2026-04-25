"use client";

import { RequireAuth } from "@/core/services/auth-provider";
import { AppShell } from "@/platform/web/components/layouts/app-shell";
import { MobileBottomNav } from "@/platform/web/components/layouts/mobile-bottom-nav";
import { useIsMobile } from "@/platform/web/hooks/use-is-mobile";
import { RouteSearchProvider } from "@/core/providers/route-search-provider";
import { SimulationSearchProvider } from "@/core/providers/simulation-search-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <RequireAuth>
      <RouteSearchProvider>
        <SimulationSearchProvider>
        {isMobile ? (
          <div className="flex h-screen flex-col overflow-hidden">
            <main
              className="flex-1 overflow-y-auto px-4 py-4"
              style={{ paddingBottom: "calc(4.5rem + 1rem + var(--safe-area-bottom))" }}
            >{children}</main>
            <MobileBottomNav />
          </div>
        ) : (
          <AppShell>{children}</AppShell>
        )}
        </SimulationSearchProvider>
      </RouteSearchProvider>
    </RequireAuth>
  );
}
