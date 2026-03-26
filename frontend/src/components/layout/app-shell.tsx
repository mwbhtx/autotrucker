"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RouteIcon, ClipboardList, BarChart3, Settings, Shield, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

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
  const [mobileOpen, setMobileOpen] = useState(false);

  const allNavItems =
    user?.role === "admin"
      ? [...navItems, ...adminNavItems]
      : navItems;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top nav bar */}
      <header className="flex h-14 shrink-0 items-center border-b bg-sidebar px-4">
        {/* Logo */}
        <Link href="/routes" className="text-3xl text-sidebar-foreground tracking-wide" style={{ fontFamily: 'var(--font-bebas-neue)' }}>
          HAULVISOR
        </Link>

        {/* Desktop nav */}
        <nav className="ml-8 hidden items-center gap-1 md:flex">
          {allNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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

        {/* Desktop user section */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-sidebar-foreground/70">
            {user?.email || user?.username || "Guest"}
          </span>
          <Button
            variant="ghost"
            onClick={logout}
            title="Log out"
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs">Sign Out</span>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="rounded-md p-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground md:hidden"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 right-0 top-14 z-50 border-b bg-sidebar p-2 md:hidden">
            <nav className="space-y-1">
              {allNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-2 border-t pt-2">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-sm text-sidebar-foreground/70">
                  {user?.email || user?.username || "Guest"}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  title="Log out"
                  className="gap-1.5"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-xs">Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
