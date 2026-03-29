"use client";

import { OnbordaProvider, Onborda } from "onborda";
import { RequireAuth } from "@/core/services/auth-provider";
import { AppShell } from "@/platform/web/components/layouts/app-shell";
import { MobileBottomNav } from "@/platform/web/components/layouts/mobile-bottom-nav";
import { OnbordaCard } from "@/platform/web/components/onborda-card";
import { tourSteps } from "@/platform/web/components/tour-steps";
import { useIsMobile } from "@/platform/web/hooks/use-is-mobile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <RequireAuth>
      <OnbordaProvider>
        <Onborda
          steps={tourSteps}
          shadowRgb="0,0,0"
          shadowOpacity="0.7"
          cardComponent={OnbordaCard}
        >
          {isMobile ? (
            <div className="flex h-screen flex-col overflow-hidden">
              <main
                className="flex-1 overflow-y-auto px-4 py-4"
                style={{ paddingBottom: "calc(4rem + 1rem + var(--safe-area-bottom))" }}
              >{children}</main>
              <MobileBottomNav />
            </div>
          ) : (
            <AppShell>{children}</AppShell>
          )}
        </Onborda>
      </OnbordaProvider>
    </RequireAuth>
  );
}
