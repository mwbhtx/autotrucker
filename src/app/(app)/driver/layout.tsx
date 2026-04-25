"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, RouteIcon, DollarSign, BellRing } from "lucide-react";
import { useIsMobile } from "@/platform/web/hooks/use-is-mobile";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/platform/web/components/ui/tabs";

const tabs = [
  { value: "/driver/orders", label: "Past Orders", icon: Package },
  { value: "/driver/routes", label: "Past Routes", icon: RouteIcon },
  { value: "/driver/earnings", label: "Earnings", icon: DollarSign },
  { value: "/driver/alerts", label: "Alerts", icon: BellRing },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Mobile keeps its own simpler tab strip; the sub-nav band is desktop-only.
  if (isMobile) {
    return <div className="flex flex-col gap-4">{children}</div>;
  }

  const activeTab = tabs.find((t) => pathname.startsWith(t.value))?.value ?? tabs[0].value;

  return (
    <div className="flex h-full flex-col">
      {/* Sub-nav band — flush with the top nav, sticky as page scrolls */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 border-b border-border/50 bg-sidebar px-6 py-2">
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
