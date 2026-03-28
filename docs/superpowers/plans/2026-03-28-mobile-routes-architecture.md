# Mobile Routes Experience & Architecture Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor haulvisor into a feature-based architecture with shared core, redesign the mobile routes experience as an Uber-inspired sequential flow, and add mobile bottom tab navigation.

**Architecture:** Feature-based modules (`core/`, `features/`, `platform/`) with strict dependency rules. Data hooks live in `core/` and are platform-agnostic. Views are split into `desktop/` and `mobile/` per feature. The Next.js `app/` directory contains thin page shells that delegate to platform-specific views.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, TanStack React Query, Tailwind CSS 4, shadcn/ui (Radix), Framer Motion, Mapbox GL, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-28-mobile-routes-architecture-design.md`

---

## File Structure

All paths relative to `src/`.

### New directories to create:
```
core/hooks/
core/services/
core/types/
core/utils/
features/routes/hooks/
features/routes/components/
features/routes/views/desktop/
features/routes/views/mobile/screens/
features/orders/components/
features/orders/views/desktop/
features/dashboard/components/
features/dashboard/views/desktop/
features/settings/views/desktop/
features/admin/views/desktop/
platform/web/components/ui/
platform/web/components/layouts/
platform/web/hooks/
```

### Migration mapping (move = git mv):
| From | To |
|------|----|
| `lib/api.ts` | `core/services/api.ts` |
| `lib/auth.ts` | `core/services/auth.ts` |
| `lib/types.ts` | `core/types/index.ts` |
| `lib/utils.ts` | `core/utils/index.ts` |
| `lib/group-by-location.ts` | `core/utils/group-by-location.ts` |
| `lib/route-colors.ts` | `core/utils/route-colors.ts` |
| `lib/rate-color.ts` | `core/utils/rate-color.ts` |
| `lib/map/draw-route.ts` | `core/utils/map/draw-route.ts` |
| `lib/tour-steps.tsx` | `platform/web/components/tour-steps.tsx` |
| `lib/hooks/use-routes.ts` | `core/hooks/use-routes.ts` |
| `lib/hooks/use-orders.ts` | `core/hooks/use-orders.ts` |
| `lib/hooks/use-settings.ts` | `core/hooks/use-settings.ts` |
| `lib/hooks/use-analytics.ts` | `core/hooks/use-analytics.ts` |
| `components/ui/*` (22 files) | `platform/web/components/ui/*` |
| `components/layout/app-shell.tsx` | `platform/web/components/layouts/app-shell.tsx` |
| `components/auth-provider.tsx` | `core/services/auth-provider.tsx` |
| `components/providers.tsx` | `core/services/providers.tsx` |
| `components/onborda-card.tsx` | `platform/web/components/onborda-card.tsx` |
| `components/marketing-nav.tsx` | `platform/web/components/marketing-nav.tsx` |
| `components/route-paths-background.tsx` | `platform/web/components/route-paths-background.tsx` |
| `components/topo-background.tsx` | `platform/web/components/topo-background.tsx` |
| `components/shader-gradient-button.tsx` | `platform/web/components/shader-gradient-button.tsx` |
| `components/map/route-map.tsx` | `features/routes/components/route-map.tsx` |
| `components/map/search-form.tsx` | `features/routes/components/search-form.tsx` |
| `components/map/location-sidebar.tsx` | `features/routes/views/desktop/location-sidebar.tsx` |
| `components/map/route-inspector.tsx` | `features/routes/components/route-inspector.tsx` |
| `components/map/mobile-carousel.tsx` | **DELETE after mobile views built** |
| `components/dashboard/*.tsx` (11 files) | `features/dashboard/components/*.tsx` |
| `components/orders/*.tsx` (5 files) | `features/orders/components/*.tsx` |

### New files to create:
| File | Purpose |
|------|---------|
| `platform/web/hooks/use-is-mobile.ts` | Single `useIsMobile()` hook, replaces scattered inline checks |
| `platform/web/components/layouts/mobile-bottom-nav.tsx` | Bottom tab bar (Routes, Orders, Dashboard, Settings) |
| `features/routes/views/desktop/desktop-routes-view.tsx` | Desktop routes — extracts current page.tsx desktop rendering |
| `features/routes/views/mobile/mobile-routes-view.tsx` | Mobile routes — screen stack orchestrator |
| `features/routes/views/mobile/screens/home-screen.tsx` | Search bar + recent searches |
| `features/routes/views/mobile/screens/search-sheet.tsx` | Full-screen search (origin, dest, trip type, search button) |
| `features/routes/views/mobile/screens/filters-sheet.tsx` | Advanced filters (trailer, deadhead, idle, home-by, legs) |
| `features/routes/views/mobile/screens/results-screen.tsx` | Vertical route card list |
| `features/routes/views/mobile/screens/detail-screen.tsx` | Tabbed route detail (overview, segments, timeline) |
| `features/routes/hooks/use-mobile-route-nav.ts` | Screen stack state management for mobile flow |
| `features/routes/hooks/use-recent-searches.ts` | Fetch/save recent searches via React Query |
| `features/routes/components/route-card.tsx` | Shared compact route card (used in results + desktop) |
| `features/orders/views/desktop/desktop-orders-view.tsx` | Wraps current orders page logic |
| `features/dashboard/views/desktop/desktop-dashboard-view.tsx` | Wraps current dashboard page logic |
| `features/settings/views/desktop/desktop-settings-view.tsx` | Wraps current settings page logic |
| `features/admin/views/desktop/desktop-admin-view.tsx` | Wraps current admin page logic |

---

## Task 1: Create directory structure and move core files

**Files:**
- Move: All files listed in migration mapping above
- Modify: `tsconfig.json` (path alias stays `@/*` → `./src/*`, no change needed)

- [ ] **Step 1: Create all new directories**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor
mkdir -p src/core/{hooks,services,types,utils/map}
mkdir -p src/features/routes/{hooks,components,views/{desktop,mobile/screens}}
mkdir -p src/features/orders/{components,views/desktop}
mkdir -p src/features/dashboard/{components,views/desktop}
mkdir -p src/features/settings/views/desktop
mkdir -p src/features/admin/views/desktop
mkdir -p src/platform/web/{components/{ui,layouts},hooks}
```

- [ ] **Step 2: Move core layer files**

```bash
git mv src/lib/api.ts src/core/services/api.ts
git mv src/lib/auth.ts src/core/services/auth.ts
git mv src/lib/types.ts src/core/types/index.ts
git mv src/lib/utils.ts src/core/utils/index.ts
git mv src/lib/group-by-location.ts src/core/utils/group-by-location.ts
git mv src/lib/route-colors.ts src/core/utils/route-colors.ts
git mv src/lib/rate-color.ts src/core/utils/rate-color.ts
git mv src/lib/map/draw-route.ts src/core/utils/map/draw-route.ts
git mv src/lib/hooks/use-routes.ts src/core/hooks/use-routes.ts
git mv src/lib/hooks/use-orders.ts src/core/hooks/use-orders.ts
git mv src/lib/hooks/use-settings.ts src/core/hooks/use-settings.ts
git mv src/lib/hooks/use-analytics.ts src/core/hooks/use-analytics.ts
git mv src/components/auth-provider.tsx src/core/services/auth-provider.tsx
git mv src/components/providers.tsx src/core/services/providers.tsx
```

- [ ] **Step 3: Move platform layer files**

```bash
# UI components (all 22 files)
git mv src/components/ui/badge.tsx src/platform/web/components/ui/
git mv src/components/ui/beams.tsx src/platform/web/components/ui/
git mv src/components/ui/button.tsx src/platform/web/components/ui/
git mv src/components/ui/calendar.tsx src/platform/web/components/ui/
git mv src/components/ui/card.tsx src/platform/web/components/ui/
git mv src/components/ui/chart.tsx src/platform/web/components/ui/
git mv src/components/ui/dialog.tsx src/platform/web/components/ui/
git mv src/components/ui/dropdown-menu.tsx src/platform/web/components/ui/
git mv src/components/ui/input.tsx src/platform/web/components/ui/
git mv src/components/ui/popover.tsx src/platform/web/components/ui/
git mv src/components/ui/select.tsx src/platform/web/components/ui/
git mv src/components/ui/separator.tsx src/platform/web/components/ui/
git mv src/components/ui/skeleton.tsx src/platform/web/components/ui/
git mv src/components/ui/slider.tsx src/platform/web/components/ui/
git mv src/components/ui/sonner.tsx src/platform/web/components/ui/
git mv src/components/ui/tabs.tsx src/platform/web/components/ui/
git mv src/components/ui/magnetic.tsx src/platform/web/components/ui/
git mv src/components/ui/border-beam.tsx src/platform/web/components/ui/
git mv src/components/ui/background-beams.tsx src/platform/web/components/ui/
git mv src/components/ui/background-beams-with-collision.tsx src/platform/web/components/ui/
git mv src/components/ui/table.tsx src/platform/web/components/ui/
git mv src/components/ui/tooltip.tsx src/platform/web/components/ui/

# Layout
git mv src/components/layout/app-shell.tsx src/platform/web/components/layouts/app-shell.tsx

# Other platform components
git mv src/components/onborda-card.tsx src/platform/web/components/onborda-card.tsx
git mv src/components/marketing-nav.tsx src/platform/web/components/marketing-nav.tsx
git mv src/components/route-paths-background.tsx src/platform/web/components/route-paths-background.tsx
git mv src/components/topo-background.tsx src/platform/web/components/topo-background.tsx
git mv src/components/shader-gradient-button.tsx src/platform/web/components/shader-gradient-button.tsx
git mv src/lib/tour-steps.tsx src/platform/web/components/tour-steps.tsx
```

- [ ] **Step 4: Move feature files**

```bash
# Routes
git mv src/components/map/route-map.tsx src/features/routes/components/route-map.tsx
git mv src/components/map/search-form.tsx src/features/routes/components/search-form.tsx
git mv src/components/map/location-sidebar.tsx src/features/routes/views/desktop/location-sidebar.tsx
git mv src/components/map/route-inspector.tsx src/features/routes/components/route-inspector.tsx
git mv src/components/map/mobile-carousel.tsx src/features/routes/components/mobile-carousel.tsx

# Dashboard (11 files)
git mv src/components/dashboard/activity-breakdown.tsx src/features/dashboard/components/
git mv src/components/dashboard/availability-chart.tsx src/features/dashboard/components/
git mv src/components/dashboard/churn-chart.tsx src/features/dashboard/components/
git mv src/components/dashboard/load-count-chart.tsx src/features/dashboard/components/
git mv src/components/dashboard/order-history-chart.tsx src/features/dashboard/components/
git mv src/components/dashboard/rate-pay-chart.tsx src/features/dashboard/components/
git mv src/components/dashboard/state-breakdown.tsx src/features/dashboard/components/
git mv src/components/dashboard/stats-cards.tsx src/features/dashboard/components/
git mv src/components/dashboard/top-cities-chart.tsx src/features/dashboard/components/
git mv src/components/dashboard/top-lanes-chart.tsx src/features/dashboard/components/
git mv src/components/dashboard/trailer-type-chart.tsx src/features/dashboard/components/

# Orders (5 files)
git mv src/components/orders/order-detail.tsx src/features/orders/components/
git mv src/components/orders/order-summary-card.tsx src/features/orders/components/
git mv src/components/orders/stopoffs-table.tsx src/features/orders/components/
git mv src/components/orders/orders-table.tsx src/features/orders/components/
git mv src/components/orders/orders-filters.tsx src/features/orders/components/
```

- [ ] **Step 5: Commit the file moves**

```bash
git add -A
git commit -m "refactor: move files to feature-based architecture

Reorganize into core/, features/, platform/ structure:
- core/: hooks, services, types, utils (platform-agnostic)
- features/: routes, orders, dashboard, settings, admin
- platform/web/: UI primitives, layouts, web-specific hooks"
```

---

## Task 2: Update all import paths

After moving files, every `@/components/...`, `@/lib/...` import across the codebase needs updating. This is the largest mechanical task.

**Files:**
- Modify: Every `.tsx` and `.ts` file that imports from moved locations

- [ ] **Step 1: Update imports in core/ files**

These files reference each other. Update internal imports:

In `src/core/services/api.ts`, update:
```
Old: import { getSessionToken, isDemoUser, logout } from "./auth";
New: import { getSessionToken, isDemoUser, logout } from "@/core/services/auth";
```

In `src/core/services/auth-provider.tsx`, update:
```
Old: import { ... } from "@/lib/auth";
New: import { ... } from "@/core/services/auth";

Old: import { fetchApi } from "@/lib/api";
New: import { fetchApi } from "@/core/services/api";
```

In `src/core/services/providers.tsx`, update:
```
Old: import { AuthProvider } from "@/components/auth-provider";
New: import { AuthProvider } from "@/core/services/auth-provider";

Old: import { Toaster } from "@/components/ui/sonner";
New: import { Toaster } from "@/platform/web/components/ui/sonner";

Old: import { TooltipProvider } from "@/components/ui/tooltip";
New: import { TooltipProvider } from "@/platform/web/components/ui/tooltip";
```

In `src/core/hooks/use-routes.ts`, update:
```
Old: import { fetchApi } from "@/lib/api";
New: import { fetchApi } from "@/core/services/api";

Old: import type { RouteSearchResult } from "@/lib/types";
New: import type { RouteSearchResult } from "@/core/types";
```

In `src/core/hooks/use-orders.ts`, update:
```
Old: import { fetchApi } from "@/lib/api";
New: import { fetchApi } from "@/core/services/api";
```

In `src/core/hooks/use-settings.ts`, update:
```
Old: import { fetchApi } from "@/lib/api";
New: import { fetchApi } from "@/core/services/api";
```

In `src/core/hooks/use-analytics.ts`, update:
```
Old: import { fetchApi } from "@/lib/api";
New: import { fetchApi } from "@/core/services/api";
```

- [ ] **Step 2: Update imports in platform/ files**

In `src/platform/web/components/layouts/app-shell.tsx`, update:
```
Old: import { cn } from "@/lib/utils";
New: import { cn } from "@/core/utils";

Old: import { useAuth } from "@/components/auth-provider";
New: import { useAuth } from "@/core/services/auth-provider";

Old: import { Button } from "@/components/ui/button";
New: import { Button } from "@/platform/web/components/ui/button";
```

In `src/platform/web/components/onborda-card.tsx` — update any `@/components/ui/` imports to `@/platform/web/components/ui/` and any `@/lib/` imports to their new `@/core/` paths.

In all 22 `src/platform/web/components/ui/*.tsx` files — update any internal cross-references. These shadcn files commonly import from each other and from `@/lib/utils`. Update all:
```
Old: import { cn } from "@/lib/utils"
New: import { cn } from "@/core/utils"
```

And any component cross-references like:
```
Old: from "@/components/ui/button"
New: from "@/platform/web/components/ui/button"
```

- [ ] **Step 3: Update imports in feature files**

In `src/features/routes/components/route-map.tsx`, update:
```
Old: import { ... } from "@/lib/map/draw-route";
New: import { ... } from "@/core/utils/map/draw-route";

Old: import { ... } from "@/lib/route-colors";
New: import { ... } from "@/core/utils/route-colors";
```

In `src/features/routes/components/search-form.tsx`, update all:
```
@/lib/utils → @/core/utils
@/lib/hooks/use-settings → @/core/hooks/use-settings
@/lib/auth → @/core/services/auth
@/components/ui/* → @/platform/web/components/ui/*
@/components/auth-provider → @/core/services/auth-provider
```

In `src/features/routes/views/desktop/location-sidebar.tsx`, update all:
```
@/lib/utils → @/core/utils
@/lib/types → @/core/types
@/lib/rate-color → @/core/utils/rate-color
@/components/ui/* → @/platform/web/components/ui/*
@/components/auth-provider → @/core/services/auth-provider
@/lib/api → @/core/services/api
```

In `src/features/routes/components/route-inspector.tsx`, update:
```
@/lib/types → @/core/types
```

In `src/features/routes/components/mobile-carousel.tsx`, update:
```
@/lib/utils → @/core/utils
@/lib/types → @/core/types
@/lib/rate-color → @/core/utils/rate-color
@/components/ui/* → @/platform/web/components/ui/*
```

In all `src/features/dashboard/components/*.tsx` files, update:
```
@/lib/hooks/use-analytics → @/core/hooks/use-analytics
@/lib/types → @/core/types
@/components/ui/* → @/platform/web/components/ui/*
@/components/auth-provider → @/core/services/auth-provider
```

In all `src/features/orders/components/*.tsx` files, update:
```
@/lib/types → @/core/types
@/lib/utils → @/core/utils
@/components/ui/* → @/platform/web/components/ui/*
@/lib/hooks/use-orders → @/core/hooks/use-orders
@/components/auth-provider → @/core/services/auth-provider
```

- [ ] **Step 4: Update imports in app/ page files**

In `src/app/layout.tsx`, update:
```
Old: import { Providers } from "@/components/providers";
New: import { Providers } from "@/core/services/providers";
```

In `src/app/(app)/layout.tsx`, update:
```
Old: import { RequireAuth } from "@/components/auth-provider";
New: import { RequireAuth } from "@/core/services/auth-provider";

Old: import { AppShell } from "@/components/layout/app-shell";
New: import { AppShell } from "@/platform/web/components/layouts/app-shell";

Old: import { OnbordaCard } from "@/components/onborda-card";
New: import { OnbordaCard } from "@/platform/web/components/onborda-card";

Old: import { tourSteps } from "@/lib/tour-steps";
New: import { tourSteps } from "@/platform/web/components/tour-steps";
```

In `src/app/(app)/routes/page.tsx`, update:
```
@/components/map/route-map → @/features/routes/components/route-map
@/components/map/search-form → @/features/routes/components/search-form
@/components/map/location-sidebar → @/features/routes/views/desktop/location-sidebar
@/components/map/mobile-carousel → @/features/routes/components/mobile-carousel
@/lib/hooks/use-routes → @/core/hooks/use-routes
@/lib/hooks/use-orders → @/core/hooks/use-orders
@/components/auth-provider → @/core/services/auth-provider
@/lib/hooks/use-settings → @/core/hooks/use-settings
@/lib/auth → @/core/services/auth
@/lib/group-by-location → @/core/utils/group-by-location
@/lib/types → @/core/types
@/lib/map/draw-route → @/core/utils/map/draw-route
```

In `src/app/(app)/orders/page.tsx`, update:
```
@/components/orders/* → @/features/orders/components/*
@/lib/hooks/use-orders → @/core/hooks/use-orders
@/components/auth-provider → @/core/services/auth-provider
@/components/ui/* → @/platform/web/components/ui/*
```

In `src/app/(app)/dashboard/page.tsx`, update:
```
@/components/dashboard/* → @/features/dashboard/components/*
@/components/auth-provider → @/core/services/auth-provider
```

In `src/app/(app)/settings/page.tsx`, update:
```
@/lib/hooks/use-settings → @/core/hooks/use-settings
@/components/auth-provider → @/core/services/auth-provider
@/components/ui/* → @/platform/web/components/ui/*
@/components/map/search-form → @/features/routes/components/search-form
@/lib/utils → @/core/utils
```

In `src/app/(app)/admin/page.tsx`, update:
```
@/components/auth-provider → @/core/services/auth-provider
@/lib/api → @/core/services/api
@/components/ui/* → @/platform/web/components/ui/*
@/lib/utils → @/core/utils
```

In `src/app/login/page.tsx` (if it imports from moved paths), update similarly.

In `src/app/page.tsx` (landing page), update any `@/components/` imports to their new locations.

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build 2>&1 | head -100`

Expected: Build succeeds with no import errors. If there are errors, they will point to specific files with broken imports — fix each one.

- [ ] **Step 6: Commit import updates**

```bash
git add -A
git commit -m "refactor: update all import paths for new architecture

Update ~60 files to use new path conventions:
- @/lib/* → @/core/*
- @/components/ui/* → @/platform/web/components/ui/*
- @/components/map/* → @/features/routes/components/*
- @/components/orders/* → @/features/orders/components/*
- @/components/dashboard/* → @/features/dashboard/components/*"
```

---

## Task 3: Create useIsMobile hook

**Files:**
- Create: `src/platform/web/hooks/use-is-mobile.ts`

- [ ] **Step 1: Create the hook**

Create `src/platform/web/hooks/use-is-mobile.ts`:

```typescript
"use client";

import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/platform/web/hooks/use-is-mobile.ts
git commit -m "feat: add useIsMobile hook as single source of truth for mobile detection"
```

---

## Task 4: Create MobileBottomNav component

**Files:**
- Create: `src/platform/web/components/layouts/mobile-bottom-nav.tsx`

- [ ] **Step 1: Create the bottom nav component**

Create `src/platform/web/components/layouts/mobile-bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ClipboardList, BarChart3, Settings } from "lucide-react";
import { cn } from "@/core/utils";

const tabs = [
  { href: "/routes", label: "Routes", icon: Search },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-white/10 bg-[#111111] pb-safe">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors",
              isActive
                ? "text-white"
                : "text-white/40 active:text-white/70",
            )}
          >
            <tab.icon className={cn("h-5 w-5", isActive && "text-primary")} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/platform/web/components/layouts/mobile-bottom-nav.tsx
git commit -m "feat: add MobileBottomNav component with 4-tab navigation"
```

---

## Task 5: Update app layout to use platform-aware navigation

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/platform/web/components/layouts/app-shell.tsx`

- [ ] **Step 1: Update app layout to conditionally render mobile vs desktop shell**

Rewrite `src/app/(app)/layout.tsx`:

```tsx
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
              <main className="flex-1 overflow-y-auto pb-16">{children}</main>
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
```

- [ ] **Step 2: Remove mobile hamburger menu from AppShell**

In `src/platform/web/components/layouts/app-shell.tsx`, remove the mobile hamburger button (lines 84-89), the mobile dropdown overlay (lines 93-142), and the `mobileOpen` state. AppShell is now desktop-only. Remove the `md:hidden` and `md:flex` qualifiers from the desktop nav since it always renders on desktop now.

Replace the entire component with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RouteIcon, ClipboardList, BarChart3, Settings, Shield, LogOut } from "lucide-react";
import { cn } from "@/core/utils";
import { useAuth } from "@/core/services/auth-provider";
import { Button } from "@/platform/web/components/ui/button";

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
                    ? "bg-[#161616] text-sidebar-foreground"
                    : "text-sidebar-foreground/50 hover:bg-white/10 hover:text-sidebar-foreground",
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-sidebar-foreground/70">
            {user?.email || user?.username || "Guest"}
          </span>
          <Button
            variant="default"
            size="sm"
            onClick={logout}
            title="Log out"
            className="gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -50`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: platform-aware app layout with mobile bottom nav and desktop top nav"
```

---

## Task 6: Create useMobileRouteNav hook

**Files:**
- Create: `src/features/routes/hooks/use-mobile-route-nav.ts`

- [ ] **Step 1: Create the screen navigation hook**

Create `src/features/routes/hooks/use-mobile-route-nav.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";

export type MobileScreen =
  | { type: "home" }
  | { type: "search" }
  | { type: "filters" }
  | { type: "results" }
  | { type: "detail"; routeIndex: number };

export function useMobileRouteNav() {
  const [screenStack, setScreenStack] = useState<MobileScreen[]>([{ type: "home" }]);

  const currentScreen = screenStack[screenStack.length - 1];

  const push = useCallback((screen: MobileScreen) => {
    setScreenStack((prev) => [...prev, screen]);
  }, []);

  const pop = useCallback(() => {
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback(() => {
    setScreenStack([{ type: "home" }]);
  }, []);

  const goToResults = useCallback(() => {
    // Replace stack with home → results (skip search sheet)
    setScreenStack([{ type: "home" }, { type: "results" }]);
  }, []);

  return { currentScreen, push, pop, reset, goToResults };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/routes/hooks/use-mobile-route-nav.ts
git commit -m "feat: add useMobileRouteNav hook for mobile screen stack navigation"
```

---

## Task 7: Create useRecentSearches hook

**Files:**
- Create: `src/features/routes/hooks/use-recent-searches.ts`

- [ ] **Step 1: Create the recent searches hook**

Create `src/features/routes/hooks/use-recent-searches.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import { useAuth } from "@/core/services/auth-provider";

export interface RecentSearch {
  id: string;
  tripMode: "one_way" | "round_trip";
  origin: { label: string; coordinates: [number, number] };
  destination: { label: string; coordinates: [number, number] };
  filters: {
    trailerType?: string;
    maxIdle?: number;
    deadheadPercent?: number;
    homeBy?: string;
    legs?: number;
    sort?: string;
  };
  searchedAt: string;
}

export function useRecentSearches() {
  const { activeCompanyId } = useAuth();

  const query = useQuery<RecentSearch[]>({
    queryKey: ["recent-searches", activeCompanyId],
    queryFn: () => fetchApi<RecentSearch[]>(`recent-searches`),
    enabled: !!activeCompanyId,
    staleTime: 60_000,
  });

  return query;
}

export function useSaveRecentSearch() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useAuth();

  return useMutation({
    mutationFn: (search: Omit<RecentSearch, "id" | "searchedAt">) =>
      fetchApi("recent-searches", {
        method: "POST",
        body: JSON.stringify(search),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-searches", activeCompanyId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/routes/hooks/use-recent-searches.ts
git commit -m "feat: add useRecentSearches hook for backend-persisted recent searches"
```

---

## Task 8: Create shared RouteCard component

**Files:**
- Create: `src/features/routes/components/route-card.tsx`

- [ ] **Step 1: Create the compact route card**

Create `src/features/routes/components/route-card.tsx`:

```tsx
"use client";

import { MapPin, TrendingUp, Truck } from "lucide-react";
import { cn } from "@/core/utils";
import type { RouteChain, RoundTripChain } from "@/core/types";

interface RouteCardProps {
  chain: RouteChain | RoundTripChain;
  isRoundTrip: boolean;
  costPerMile: number;
  onClick: () => void;
  className?: string;
}

function getOriginCity(chain: RouteChain | RoundTripChain): string {
  const firstLeg = chain.legs[0];
  if (!firstLeg) return "Unknown";
  return firstLeg.origin_city ?? "Unknown";
}

function getDestCity(chain: RouteChain | RoundTripChain): string {
  const lastLeg = chain.legs[chain.legs.length - 1];
  if (!lastLeg) return "Unknown";
  return lastLeg.destination_city ?? "Unknown";
}

function getTotalMiles(chain: RouteChain | RoundTripChain): number {
  return chain.legs.reduce((sum, leg) => sum + (leg.miles ?? 0), 0);
}

function getDailyProfit(chain: RouteChain | RoundTripChain): number | null {
  if ("daily_profit" in chain && typeof chain.daily_profit === "number") {
    return chain.daily_profit;
  }
  return null;
}

function getDeadheadPct(chain: RouteChain | RoundTripChain): number | null {
  if ("deadhead_pct" in chain && typeof chain.deadhead_pct === "number") {
    return chain.deadhead_pct;
  }
  return null;
}

export function RouteCard({ chain, isRoundTrip, costPerMile, onClick, className }: RouteCardProps) {
  const origin = getOriginCity(chain);
  const dest = getDestCity(chain);
  const miles = getTotalMiles(chain);
  const dailyProfit = getDailyProfit(chain);
  const deadhead = getDeadheadPct(chain);
  const legCount = chain.legs.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-white/10 bg-card p-4 transition-colors active:bg-muted/50",
        className,
      )}
    >
      {/* Header: origin → destination */}
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium truncate">
          {origin} → {dest}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {isRoundTrip ? "Round trip" : "One way"}
        </span>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {dailyProfit !== null && (
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span className={cn("font-semibold", dailyProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
              ${Math.round(dailyProfit)}/day
            </span>
          </span>
        )}
        <span>{miles.toLocaleString()} mi</span>
        <span className="flex items-center gap-1">
          <Truck className="h-3 w-3" />
          {legCount} {legCount === 1 ? "leg" : "legs"}
        </span>
        {deadhead !== null && (
          <span>{Math.round(deadhead)}% DH</span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/routes/components/route-card.tsx
git commit -m "feat: add shared RouteCard component for mobile and desktop route lists"
```

---

## Task 9: Create mobile route screens

**Files:**
- Create: `src/features/routes/views/mobile/screens/home-screen.tsx`
- Create: `src/features/routes/views/mobile/screens/search-sheet.tsx`
- Create: `src/features/routes/views/mobile/screens/filters-sheet.tsx`
- Create: `src/features/routes/views/mobile/screens/results-screen.tsx`
- Create: `src/features/routes/views/mobile/screens/detail-screen.tsx`

- [ ] **Step 1: Create HomeScreen**

Create `src/features/routes/views/mobile/screens/home-screen.tsx`:

```tsx
"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useRecentSearches, type RecentSearch } from "@/features/routes/hooks/use-recent-searches";

interface HomeScreenProps {
  onSearchBarTap: () => void;
  onFiltersTap: () => void;
  onRecentTap: (search: RecentSearch) => void;
}

export function HomeScreen({ onSearchBarTap, onFiltersTap, onRecentTap }: HomeScreenProps) {
  const { data: recentSearches, isLoading } = useRecentSearches();

  return (
    <div className="flex flex-col h-full px-4 pt-4">
      {/* Search bar */}
      <button
        type="button"
        onClick={onSearchBarTap}
        className="flex items-center gap-3 rounded-full border border-white/10 bg-card px-4 py-3"
      >
        <Search className="h-5 w-5 text-muted-foreground" />
        <span className="flex-1 text-left text-sm text-muted-foreground">Search Routes</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFiltersTap();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </button>

      {/* Recent searches */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Searches</h3>
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}
        {!isLoading && (!recentSearches || recentSearches.length === 0) && (
          <p className="text-xs text-muted-foreground/60">No recent searches yet</p>
        )}
        {!isLoading && recentSearches && recentSearches.length > 0 && (
          <div className="space-y-1">
            {recentSearches.map((search) => (
              <button
                key={search.id}
                type="button"
                onClick={() => onRecentTap(search)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors active:bg-muted/30"
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {search.origin.label} → {search.destination.label}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {search.tripMode === "one_way" ? "One-way" : "Round-trip"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SearchSheet**

Create `src/features/routes/views/mobile/screens/search-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { PlaceAutocomplete } from "@/features/routes/components/search-form";
import { Button } from "@/platform/web/components/ui/button";

interface SearchSheetProps {
  onBack: () => void;
  onSearch: (params: {
    tripMode: "one-way" | "round-trip";
    origin: { label: string; lat: number; lng: number };
    destination: { label: string; lat: number; lng: number };
  }) => void;
  initialTripMode?: "one-way" | "round-trip";
  initialOrigin?: { label: string; lat: number; lng: number } | null;
  initialDestination?: { label: string; lat: number; lng: number } | null;
}

export function SearchSheet({
  onBack,
  onSearch,
  initialTripMode = "round-trip",
  initialOrigin = null,
  initialDestination = null,
}: SearchSheetProps) {
  const [tripMode, setTripMode] = useState<"one-way" | "round-trip">(initialTripMode);
  const [origin, setOrigin] = useState<{ label: string; lat: number; lng: number } | null>(initialOrigin);
  const [destination, setDestination] = useState<{ label: string; lat: number; lng: number } | null>(initialDestination);

  const canSearch = !!origin;

  const handleSubmit = () => {
    if (!origin) return;
    onSearch({
      tripMode,
      origin,
      destination: destination ?? origin, // Round trip uses origin as destination
    });
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button type="button" onClick={onBack} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Plan Your Route</h2>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Trip type toggle */}
        <div className="flex rounded-lg border border-white/10 p-1">
          <button
            type="button"
            onClick={() => setTripMode("one-way")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tripMode === "one-way" ? "bg-white/10 text-white" : "text-muted-foreground"
            }`}
          >
            One-way
          </button>
          <button
            type="button"
            onClick={() => setTripMode("round-trip")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tripMode === "round-trip" ? "bg-white/10 text-white" : "text-muted-foreground"
            }`}
          >
            Round-trip
          </button>
        </div>

        {/* Origin */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Origin</label>
          <PlaceAutocomplete
            placeholder="Enter origin city"
            value={origin?.label ?? ""}
            onSelect={(place) => {
              if (place) {
                setOrigin({ label: place.label, lat: place.lat, lng: place.lng });
              } else {
                setOrigin(null);
              }
            }}
          />
        </div>

        {/* Destination */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Destination</label>
          <PlaceAutocomplete
            placeholder="Enter destination city"
            value={destination?.label ?? ""}
            onSelect={(place) => {
              if (place) {
                setDestination({ label: place.label, lat: place.lat, lng: place.lng });
              } else {
                setDestination(null);
              }
            }}
          />
        </div>
      </div>

      {/* Search button */}
      <div className="border-t border-white/10 px-4 py-4">
        <Button
          onClick={handleSubmit}
          disabled={!canSearch}
          className="w-full h-12 text-base font-semibold"
        >
          Search Routes
        </Button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: Create FiltersSheet**

Create `src/features/routes/views/mobile/screens/filters-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";
import { Slider } from "@/platform/web/components/ui/slider";

export interface AdvancedFilters {
  trailerType?: string;
  maxIdle?: number;
  deadheadPercent?: number;
  homeBy?: string;
  legs?: number;
  sort?: string;
}

interface FiltersSheetProps {
  onBack: () => void;
  onApply: (filters: AdvancedFilters) => void;
  initialFilters?: AdvancedFilters;
}

export function FiltersSheet({ onBack, onApply, initialFilters = {} }: FiltersSheetProps) {
  const [filters, setFilters] = useState<AdvancedFilters>(initialFilters);

  const handleApply = () => {
    onApply(filters);
    onBack();
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button type="button" onClick={onBack} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">Filters</h2>
      </div>

      {/* Filters form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Number of legs */}
        <div>
          <label className="text-sm font-medium mb-2 block">Number of Legs</label>
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, legs: n }))}
                className={`h-10 w-10 rounded-lg border text-sm font-medium transition-colors ${
                  filters.legs === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-white/10 text-muted-foreground active:bg-muted/30"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Max Deadhead % */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Max Deadhead: {filters.deadheadPercent ?? 100}%
          </label>
          <Slider
            value={[filters.deadheadPercent ?? 100]}
            onValueChange={([val]) => setFilters((f) => ({ ...f, deadheadPercent: val }))}
            min={0}
            max={100}
            step={5}
          />
        </div>

        {/* Max Idle Hours */}
        <div>
          <label className="text-sm font-medium mb-2 block">Max Idle (hours)</label>
          <Input
            type="number"
            placeholder="e.g., 24"
            value={filters.maxIdle ?? ""}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                maxIdle: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </div>

        {/* Home By Date */}
        <div>
          <label className="text-sm font-medium mb-2 block">Home By</label>
          <Input
            type="date"
            value={filters.homeBy ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, homeBy: e.target.value || undefined }))}
          />
        </div>

        {/* Trailer Type */}
        <div>
          <label className="text-sm font-medium mb-2 block">Trailer Type</label>
          <Input
            type="text"
            placeholder="e.g., Van, Reefer, Flatbed"
            value={filters.trailerType ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, trailerType: e.target.value || undefined }))}
          />
        </div>
      </div>

      {/* Apply button */}
      <div className="border-t border-white/10 px-4 py-4">
        <Button onClick={handleApply} className="w-full h-12 text-base font-semibold">
          Apply Filters
        </Button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Create ResultsScreen**

Create `src/features/routes/views/mobile/screens/results-screen.tsx`:

```tsx
"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { RouteCard } from "@/features/routes/components/route-card";
import type { LocationGroup } from "@/core/types";

interface ResultsScreenProps {
  location: LocationGroup;
  costPerMile: number;
  searchLabel: string;
  isLoading: boolean;
  onSearchBarTap: () => void;
  onFiltersTap: () => void;
  onRouteSelect: (index: number) => void;
}

export function ResultsScreen({
  location,
  costPerMile,
  searchLabel,
  isLoading,
  onSearchBarTap,
  onFiltersTap,
  onRouteSelect,
}: ResultsScreenProps) {
  const isRoundTrip = location.roundTripChains.length > 0;
  const chains = isRoundTrip ? location.roundTripChains : location.routeChains;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar showing current search */}
      <div className="px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onSearchBarTap}
          className="flex items-center gap-3 rounded-full border border-white/10 bg-card px-4 py-3 w-full"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-left text-sm text-white truncate">{searchLabel}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFiltersTap();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </button>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && chains.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">No routes found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
          </div>
        )}

        {!isLoading &&
          chains.map((chain, index) => (
            <RouteCard
              key={index}
              chain={chain}
              isRoundTrip={isRoundTrip}
              costPerMile={costPerMile}
              onClick={() => onRouteSelect(index)}
            />
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create DetailScreen**

Create `src/features/routes/views/mobile/screens/detail-screen.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft, MapPin, TrendingUp, Truck, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/core/utils";
import type { RouteChain, RoundTripChain } from "@/core/types";
import { RouteInspector } from "@/features/routes/components/route-inspector";

interface DetailScreenProps {
  chain: RouteChain | RoundTripChain;
  isRoundTrip: boolean;
  costPerMile: number;
  originCity?: string;
  onBack: () => void;
}

type DetailTab = "overview" | "segments" | "timeline";

export function DetailScreen({ chain, isRoundTrip, costPerMile, originCity, onBack }: DetailScreenProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const legs = chain.legs;
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const origin = firstLeg?.origin_city ?? "Unknown";
  const dest = lastLeg?.destination_city ?? "Unknown";
  const totalMiles = legs.reduce((sum, leg) => sum + (leg.miles ?? 0), 0);
  const dailyProfit = "daily_profit" in chain ? (chain.daily_profit as number) : null;
  const deadheadPct = "deadhead_pct" in chain ? (chain.deadhead_pct as number) : null;
  const totalPay = legs.reduce((sum, leg) => sum + (leg.rate ?? 0), 0);

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "segments", label: "Segments" },
    { key: "timeline", label: "Timeline" },
  ];

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button type="button" onClick={onBack} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{origin} → {dest}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {isRoundTrip ? "Round-trip" : "One-way"} · {legs.length} {legs.length === 1 ? "leg" : "legs"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2",
              activeTab === tab.key
                ? "border-primary text-white"
                : "border-transparent text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && (
          <div className="px-4 py-4 space-y-4">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              {dailyProfit !== null && (
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="h-3 w-3" />
                    Daily Profit
                  </div>
                  <p className={cn("text-lg font-bold", dailyProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                    ${Math.round(dailyProfit)}
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-white/10 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Truck className="h-3 w-3" />
                  Total Miles
                </div>
                <p className="text-lg font-bold">{totalMiles.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-white/10 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <MapPin className="h-3 w-3" />
                  Total Pay
                </div>
                <p className="text-lg font-bold">${totalPay.toLocaleString()}</p>
              </div>
              {deadheadPct !== null && (
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Clock className="h-3 w-3" />
                    Deadhead
                  </div>
                  <p className="text-lg font-bold">{Math.round(deadheadPct)}%</p>
                </div>
              )}
            </div>

            {/* Route summary */}
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-medium mb-3">Route Path</h3>
              <div className="space-y-2">
                {legs.map((leg, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span>{leg.origin_city} → {leg.destination_city}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{leg.miles ?? 0} mi</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "segments" && (
          <div className="px-4 py-4 space-y-3">
            {legs.map((leg, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Leg {i + 1}</h4>
                  <span className="text-xs text-muted-foreground">
                    {leg.miles ?? 0} mi
                  </span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>From: {leg.origin_city}, {leg.origin_state}</p>
                  <p>To: {leg.destination_city}, {leg.destination_state}</p>
                  {leg.rate != null && <p>Rate: ${leg.rate.toLocaleString()}</p>}
                  {leg.rate_per_mile != null && <p>$/mile: ${leg.rate_per_mile.toFixed(2)}</p>}
                  {leg.pickup_date && <p>Pickup: {new Date(leg.pickup_date).toLocaleDateString()}</p>}
                  {leg.delivery_date && <p>Delivery: {new Date(leg.delivery_date).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="px-4 py-4">
            {"trip_summary" in chain && chain.trip_summary ? (
              <RouteInspector
                chain={chain as RoundTripChain}
                originCity={originCity ?? origin}
                returnCity={originCity ?? origin}
                onClose={() => {}}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Timeline not available for this route type
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 6: Commit all screens**

```bash
git add src/features/routes/views/mobile/screens/
git commit -m "feat: add all mobile route screens (home, search, filters, results, detail)"
```

---

## Task 10: Create MobileRoutesView orchestrator

**Files:**
- Create: `src/features/routes/views/mobile/mobile-routes-view.tsx`

- [ ] **Step 1: Create the mobile routes view**

Create `src/features/routes/views/mobile/mobile-routes-view.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useMobileRouteNav } from "@/features/routes/hooks/use-mobile-route-nav";
import { useSaveRecentSearch, type RecentSearch } from "@/features/routes/hooks/use-recent-searches";
import { useRouteSearch, useRoundTripSearch, type RouteSearchParams, type RoundTripSearchParams } from "@/core/hooks/use-routes";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import { groupRoutesByLocation } from "@/core/utils/group-by-location";
import { DEFAULT_COST_PER_MILE } from "@mwbhtx/haulvisor-core";
import type { LocationGroup } from "@/core/types";
import { HomeScreen } from "./screens/home-screen";
import { SearchSheet } from "./screens/search-sheet";
import { FiltersSheet, type AdvancedFilters } from "./screens/filters-sheet";
import { ResultsScreen } from "./screens/results-screen";
import { DetailScreen } from "./screens/detail-screen";

const EMPTY_LOCATION: LocationGroup = {
  city: "",
  state: "",
  lat: 0,
  lng: 0,
  orders: [],
  routeChains: [],
  roundTripChains: [],
};

export function MobileRoutesView() {
  const { activeCompanyId } = useAuth();
  const { data: settings } = useSettings();
  const { currentScreen, push, pop, goToResults } = useMobileRouteNav();
  const saveRecentSearch = useSaveRecentSearch();

  // Search state
  const [tripMode, setTripMode] = useState<"one-way" | "round-trip">("round-trip");
  const [origin, setOrigin] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [searchParams, setSearchParams] = useState<RouteSearchParams | null>(null);
  const [roundTripParams, setRoundTripParams] = useState<RoundTripSearchParams | null>(null);
  const [displayLocation, setDisplayLocation] = useState<LocationGroup>(EMPTY_LOCATION);

  const costPerMile = (settings?.cost_per_mile as number | undefined) ?? DEFAULT_COST_PER_MILE;

  // Data queries
  const { data, isLoading } = useRouteSearch(activeCompanyId ?? "", searchParams);
  const { data: roundTripResults, isLoading: isRoundTripLoading } = useRoundTripSearch(activeCompanyId ?? "", roundTripParams);

  // Update display location when results arrive
  const routes = data?.routes ?? [];
  const roundTripRoutes = roundTripResults?.routes ?? [];

  // Build display location from results
  const getDisplayLocation = useCallback((): LocationGroup => {
    if (roundTripParams && roundTripRoutes.length > 0) {
      const rtOrigin = roundTripResults!.origin;
      return {
        city: rtOrigin.city,
        state: rtOrigin.state,
        lat: rtOrigin.lat,
        lng: rtOrigin.lng,
        orders: [],
        routeChains: [],
        roundTripChains: roundTripRoutes,
      };
    }
    if (searchParams && routes.length > 0) {
      const locations = groupRoutesByLocation(routes);
      const allChains = locations.flatMap((l) => l.routeChains);
      return {
        city: "Search Results",
        state: "",
        lat: locations[0]?.lat ?? 0,
        lng: locations[0]?.lng ?? 0,
        orders: [],
        routeChains: allChains,
        roundTripChains: [],
      };
    }
    return EMPTY_LOCATION;
  }, [roundTripParams, roundTripRoutes, roundTripResults, searchParams, routes]);

  const handleSearch = useCallback(
    (params: {
      tripMode: "one-way" | "round-trip";
      origin: { label: string; lat: number; lng: number };
      destination: { label: string; lat: number; lng: number };
    }) => {
      setTripMode(params.tripMode);
      setOrigin(params.origin);
      setDestination(params.destination);

      if (params.tripMode === "round-trip") {
        setRoundTripParams({
          origin_lat: params.origin.lat,
          origin_lng: params.origin.lng,
          origin_city: params.origin.label,
          cost_per_mile: costPerMile,
          legs: advancedFilters.legs,
          max_deadhead_pct: advancedFilters.deadheadPercent,
          home_by: advancedFilters.homeBy,
          max_layover_hours: advancedFilters.maxIdle,
          trailer_types: advancedFilters.trailerType,
        });
        setSearchParams(null);
      } else {
        setSearchParams({
          origin_lat: params.origin.lat,
          origin_lng: params.origin.lng,
          dest_lat: params.destination.lat,
          dest_lng: params.destination.lng,
          cost_per_mile: costPerMile,
          legs: advancedFilters.legs,
          max_layover_hours: advancedFilters.maxIdle,
          trailer_types: advancedFilters.trailerType,
        });
        setRoundTripParams(null);
      }

      // Save to recent searches
      saveRecentSearch.mutate({
        tripMode: params.tripMode === "one-way" ? "one_way" : "round_trip",
        origin: {
          label: params.origin.label,
          coordinates: [params.origin.lng, params.origin.lat],
        },
        destination: {
          label: params.destination.label,
          coordinates: [params.destination.lng, params.destination.lat],
        },
        filters: advancedFilters,
      });

      goToResults();
    },
    [costPerMile, advancedFilters, saveRecentSearch, goToResults],
  );

  const handleRecentTap = useCallback(
    (search: RecentSearch) => {
      const orig = {
        label: search.origin.label,
        lat: search.origin.coordinates[1],
        lng: search.origin.coordinates[0],
      };
      const dest = {
        label: search.destination.label,
        lat: search.destination.coordinates[1],
        lng: search.destination.coordinates[0],
      };
      setAdvancedFilters(search.filters);
      handleSearch({
        tripMode: search.tripMode === "one_way" ? "one-way" : "round-trip",
        origin: orig,
        destination: dest,
      });
    },
    [handleSearch],
  );

  const handleApplyFilters = useCallback((filters: AdvancedFilters) => {
    setAdvancedFilters(filters);
    // If search is active, re-run with new filters
    if (origin) {
      handleSearch({
        tripMode,
        origin,
        destination: destination ?? origin,
      });
    }
  }, [origin, destination, tripMode, handleSearch]);

  const currentLocation = getDisplayLocation();
  const searchLabel = origin
    ? `${origin.label}${destination && destination.label !== origin.label ? ` → ${destination.label}` : ""}`
    : "Search Routes";

  if (!activeCompanyId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">No company assigned</p>
          <p className="text-sm text-muted-foreground/70">Contact your admin to get access.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Base screen */}
      {currentScreen.type === "home" && (
        <HomeScreen
          onSearchBarTap={() => push({ type: "search" })}
          onFiltersTap={() => push({ type: "filters" })}
          onRecentTap={handleRecentTap}
        />
      )}

      {currentScreen.type === "results" && (
        <ResultsScreen
          location={currentLocation}
          costPerMile={costPerMile}
          searchLabel={searchLabel}
          isLoading={isLoading || isRoundTripLoading}
          onSearchBarTap={() => push({ type: "search" })}
          onFiltersTap={() => push({ type: "filters" })}
          onRouteSelect={(index) => push({ type: "detail", routeIndex: index })}
        />
      )}

      {/* Overlay screens */}
      <AnimatePresence>
        {currentScreen.type === "search" && (
          <SearchSheet
            key="search"
            onBack={pop}
            onSearch={handleSearch}
            initialTripMode={tripMode}
            initialOrigin={origin}
            initialDestination={destination}
          />
        )}

        {currentScreen.type === "filters" && (
          <FiltersSheet
            key="filters"
            onBack={pop}
            onApply={handleApplyFilters}
            initialFilters={advancedFilters}
          />
        )}

        {currentScreen.type === "detail" && (() => {
          const isRoundTrip = currentLocation.roundTripChains.length > 0;
          const chains = isRoundTrip ? currentLocation.roundTripChains : currentLocation.routeChains;
          const chain = chains[currentScreen.routeIndex];
          if (!chain) return null;
          return (
            <DetailScreen
              key="detail"
              chain={chain}
              isRoundTrip={isRoundTrip}
              costPerMile={costPerMile}
              originCity={origin?.label}
              onBack={pop}
            />
          );
        })()}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/routes/views/mobile/mobile-routes-view.tsx
git commit -m "feat: add MobileRoutesView orchestrator with screen stack navigation"
```

---

## Task 11: Create DesktopRoutesView and extract from routes page

**Files:**
- Create: `src/features/routes/views/desktop/desktop-routes-view.tsx`
- Modify: `src/app/(app)/routes/page.tsx`

- [ ] **Step 1: Create DesktopRoutesView**

Create `src/features/routes/views/desktop/desktop-routes-view.tsx` by moving the entire contents of the current `src/app/(app)/routes/page.tsx` into this file, but rename the export:

```tsx
// Copy ENTIRE contents of current routes/page.tsx here
// Change the export name from MapPage to DesktopRoutesView:
// Old: export default function MapPage() {
// New: export function DesktopRoutesView() {
```

Keep all the existing imports (already updated to new paths from Task 2). Keep all state, effects, and rendering exactly as-is for desktop. Remove all mobile-specific code:
- Remove the `isMobile` state and useEffect
- Remove the `mobileFilterOpen`, `mobileSortOpen`, `mobileSortBy` state
- Remove the `MobileFilterSheet` rendering
- Remove the `md:hidden` mobile sections (compact search bar, carousel panel)
- Remove the `MobileCarousel` import
- Remove the `MobileFilterSheet` import
- Remove `hidden md:flex` qualifiers from the desktop sections (they always render now)

- [ ] **Step 2: Replace routes page with thin shell**

Rewrite `src/app/(app)/routes/page.tsx`:

```tsx
"use client";

import { useIsMobile } from "@/platform/web/hooks/use-is-mobile";
import { DesktopRoutesView } from "@/features/routes/views/desktop/desktop-routes-view";
import { MobileRoutesView } from "@/features/routes/views/mobile/mobile-routes-view";

export default function RoutesPage() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileRoutesView /> : <DesktopRoutesView />;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -50`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: split routes page into DesktopRoutesView and MobileRoutesView

Desktop view preserves all existing functionality.
Mobile view implements new Uber-inspired sequential flow.
Page shell is now a thin platform switch."
```

---

## Task 12: Extract other page views

**Files:**
- Create: `src/features/orders/views/desktop/desktop-orders-view.tsx`
- Create: `src/features/dashboard/views/desktop/desktop-dashboard-view.tsx`
- Create: `src/features/settings/views/desktop/desktop-settings-view.tsx`
- Create: `src/features/admin/views/desktop/desktop-admin-view.tsx`
- Modify: `src/app/(app)/orders/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/app/(app)/admin/page.tsx`

- [ ] **Step 1: Extract OrdersPage logic**

Move the full contents of `src/app/(app)/orders/page.tsx` into `src/features/orders/views/desktop/desktop-orders-view.tsx`, renaming the export to `DesktopOrdersView`.

Replace `src/app/(app)/orders/page.tsx` with:

```tsx
"use client";

import { DesktopOrdersView } from "@/features/orders/views/desktop/desktop-orders-view";

export default function OrdersPage() {
  return <DesktopOrdersView />;
}
```

- [ ] **Step 2: Extract DashboardPage logic**

Move the full contents of `src/app/(app)/dashboard/page.tsx` into `src/features/dashboard/views/desktop/desktop-dashboard-view.tsx`, renaming the export to `DesktopDashboardView`.

Replace `src/app/(app)/dashboard/page.tsx` with:

```tsx
"use client";

import { DesktopDashboardView } from "@/features/dashboard/views/desktop/desktop-dashboard-view";

export default function DashboardPage() {
  return <DesktopDashboardView />;
}
```

- [ ] **Step 3: Extract SettingsPage logic**

Move the full contents of `src/app/(app)/settings/page.tsx` into `src/features/settings/views/desktop/desktop-settings-view.tsx`, renaming the export to `DesktopSettingsView`.

Replace `src/app/(app)/settings/page.tsx` with:

```tsx
"use client";

import { DesktopSettingsView } from "@/features/settings/views/desktop/desktop-settings-view";

export default function SettingsPage() {
  return <DesktopSettingsView />;
}
```

- [ ] **Step 4: Extract AdminPage logic**

Move the full contents of `src/app/(app)/admin/page.tsx` into `src/features/admin/views/desktop/desktop-admin-view.tsx`, renaming the export to `DesktopAdminView`.

Replace `src/app/(app)/admin/page.tsx` with:

```tsx
"use client";

import { DesktopAdminView } from "@/features/admin/views/desktop/desktop-admin-view";

export default function AdminPage() {
  return <DesktopAdminView />;
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | head -50`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: extract all page views into feature modules

Orders, Dashboard, Settings, and Admin now follow the same
pattern as Routes: thin page shells delegating to feature views."
```

---

## Task 13: Clean up old directories and verify

**Files:**
- Delete: Empty `src/lib/` directory (if empty after moves)
- Delete: Empty `src/components/` directory (if empty after moves)

- [ ] **Step 1: Remove empty old directories**

```bash
# Only remove if empty — check first
find src/lib -type d -empty -print
find src/components -type d -empty -print

# Remove empty dirs
find src/lib -type d -empty -delete 2>/dev/null
find src/components -type d -empty -delete 2>/dev/null

# If src/lib or src/components still have files, list them
ls -R src/lib 2>/dev/null || echo "src/lib fully migrated"
ls -R src/components 2>/dev/null || echo "src/components fully migrated"
```

- [ ] **Step 2: Delete the old mobile carousel**

After confirming MobileRoutesView works, delete the old mobile carousel:

```bash
rm src/features/routes/components/mobile-carousel.tsx
```

Remove its import from `DesktopRoutesView` if still referenced.

- [ ] **Step 3: Full build and dev server test**

Run: `npm run build`
Expected: Clean build with zero errors.

Run: `npm run dev` and test:
1. Desktop: All pages load, routes search works, map renders
2. Mobile (Chrome DevTools device mode): Bottom nav appears, routes shows search bar + recent searches, search flow works through all screens

- [ ] **Step 4: Commit cleanup**

```bash
git add -A
git commit -m "chore: clean up old directories and remove deprecated mobile carousel"
```

---

## Task 14: Add safe-area and mobile polish

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/platform/web/components/layouts/mobile-bottom-nav.tsx`

- [ ] **Step 1: Add safe-area support for iOS**

In `src/app/globals.css`, add at the top of the file (after imports):

```css
:root {
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}
```

- [ ] **Step 2: Update MobileBottomNav for safe area**

In `src/platform/web/components/layouts/mobile-bottom-nav.tsx`, update the nav height to account for safe area. Change the nav className:

```
Old: className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-white/10 bg-[#111111] pb-safe"
New: className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/10 bg-[#111111]" style={{ height: `calc(4rem + var(--safe-area-bottom))`, paddingBottom: `var(--safe-area-bottom)` }}
```

Update the app layout's content padding to match:
In `src/app/(app)/layout.tsx`, change `pb-16` to use the same calculation:

```
Old: <main className="flex-1 overflow-y-auto pb-16">{children}</main>
New: <main className="flex-1 overflow-y-auto" style={{ paddingBottom: `calc(4rem + var(--safe-area-bottom))` }}>{children}</main>
```

- [ ] **Step 3: Add viewport meta for safe area**

In `src/app/layout.tsx`, add viewport configuration:

```tsx
export const metadata: Metadata = {
  title: "haulvisor",
  description: "The load board that doesn't suck.",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};
```

Note: If using Next.js 16, viewport may need to be exported separately:
```tsx
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add iOS safe-area support for mobile bottom nav"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Create directories and move files | 5 |
| 2 | Update all import paths | 6 |
| 3 | Create useIsMobile hook | 2 |
| 4 | Create MobileBottomNav | 2 |
| 5 | Update app layout for platform-aware nav | 4 |
| 6 | Create useMobileRouteNav hook | 2 |
| 7 | Create useRecentSearches hook | 2 |
| 8 | Create shared RouteCard component | 2 |
| 9 | Create mobile route screens (5 screens) | 6 |
| 10 | Create MobileRoutesView orchestrator | 2 |
| 11 | Extract DesktopRoutesView from routes page | 4 |
| 12 | Extract other page views | 6 |
| 13 | Clean up old directories | 4 |
| 14 | Add safe-area and mobile polish | 4 |
| **Total** | | **51 steps** |

### Dependencies
- Tasks 1-2 must run first (file moves + import updates)
- Tasks 3-8 can run in parallel after Task 2
- Tasks 9-10 depend on Tasks 6, 7, 8
- Task 11 depends on Task 3
- Task 12 has no dependency on mobile work
- Tasks 13-14 are final cleanup
