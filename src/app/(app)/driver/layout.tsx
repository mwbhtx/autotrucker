"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/core/utils";

const TABS = [
  { href: "/driver/orders", label: "Orders" },
  { href: "/driver/earnings", label: "Earnings" },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b border-border">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 py-2 text-sm transition-colors",
                active
                  ? "border-b-2 border-primary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
