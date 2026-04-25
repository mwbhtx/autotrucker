"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Compass } from "lucide-react";
import { useIsMobile } from "@/platform/web/hooks/use-is-mobile";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/platform/web/components/ui/tabs";

const tabs = [
  { value: "/insights/dashboard", label: "Dashboard", icon: BarChart3 },
  { value: "/insights/route-discovery", label: "Route Discovery", icon: Compass },
];

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // On mobile, render children without the sub-nav band — mobile users land
  // directly on the dashboard via /dashboard → /insights/dashboard redirect
  // and don't see Route Discovery in v1.
  if (isMobile) return <>{children}</>;

  const activeTab =
    tabs.find((t) => pathname.startsWith(t.value))?.value ?? "/insights/dashboard";

  return (
    <div className="flex h-full flex-col">
      {/* Sub-nav band — flush with the top nav, visually attached */}
      <div className="-mx-6 -mt-6 border-b border-border/50 bg-sidebar px-6 py-2">
        <Tabs value={activeTab} className="w-fit">
          <TabsList variant="line" className="bg-transparent gap-6" asChild>
            <nav>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} asChild className="gap-1.5">
                  <Link href={tab.value}>
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                </TabsTrigger>
              ))}
            </nav>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 pt-8">{children}</div>
    </div>
  );
}
