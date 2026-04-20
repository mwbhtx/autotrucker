"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ClipboardList, BarChart3, Settings, User } from "lucide-react";
import { cn } from "@/core/utils";

const tabs = [
  { href: "/routes", label: "Routes", icon: Search },
  { href: "/driver", label: "Driver", icon: User },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/10 bg-[#111111]"
      style={{ height: "calc(4.5rem + var(--safe-area-bottom))", paddingBottom: "var(--safe-area-bottom)" }}
    >
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 text-sm transition-colors",
              isActive
                ? "text-white"
                : "text-white/40 active:text-white/70",
            )}
          >
            <tab.icon className={cn("h-6 w-6", isActive && "text-primary")} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
