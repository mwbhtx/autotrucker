"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RouteIcon, ClipboardList, BarChart3, Settings, Shield, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/core/utils";
import { useAuth } from "@/core/services/auth-provider";
import { brand } from "@mwbhtx/haulvisor-core";

const navItems = [
  { href: "/routes", label: "Routes", icon: RouteIcon },
  { href: "/orders", label: "Board", icon: ClipboardList },
  { href: "/dashboard", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNavItems = [
  { href: "/admin", label: "Admin", icon: Shield },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const allNavItems =
    user?.role === "admin"
      ? [...navItems, ...adminNavItems]
      : navItems;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top nav bar */}
      <header className="flex h-14 shrink-0 items-center bg-sidebar px-4">
        {/* Logo */}
        <Link href="/routes">
          <img src="/haulvisor-logo-text-black.svg" alt={brand.name} className="h-6 dark:hidden" />
          <img src="/haulvisor-logo-text-white.svg" alt={brand.name} className="h-6 hidden dark:block" />
        </Link>

        {/* Desktop nav */}
        <nav className="ml-8 flex items-center gap-1">
          {allNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User section */}
        <div className="flex items-center gap-1">
          <span className="hidden xl:inline text-sm text-muted-foreground mr-2">
            {user?.email || user?.username || "Guest"}
          </span>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle theme"
            className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={logout}
            title="Log out"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden xl:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
