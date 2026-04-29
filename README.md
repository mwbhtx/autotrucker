# Haulvisor

**[haulvisor.com](https://haulvisor.com)** — Route optimization platform for owner-operator truck drivers.

Haulvisor analyzes thousands of available loads and builds the most profitable multi-stop routes, factoring in deadhead, fuel costs, and scheduling constraints so drivers can maximize revenue per mile and get home on time.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Maps:** MapLibre GL JS + Protomaps tiles with custom Moonlight/Dark themes
- **Data:** REST API with React Query for caching and real-time updates
- **Auth:** JWT-based authentication with role-based access control
- **Animations:** Framer Motion, Shader Gradient
- **UI:** shadcn/ui, Radix UI primitives
- **Testing:** Vitest, Testing Library
- **Core:** — shared types, constants, cost model, and search defaults

## Key Features

- **Multi-stop route optimization** — Evaluates route chains (1–3 legs) and ranks them by a composite score factoring in pay, deadhead percentage, and cost per mile
- **Round-trip planning** — "Home By" date constraint ensures routes get drivers back on schedule
- **Real-time cost modeling** — Two modes: a single all-in cost-per-mile for drivers who already know their number, or a detailed breakdown (fuel from MPG + regional diesel price, maintenance, tires, DEF, plus user-defined custom costs like tolls or factoring) with a live effective-cpm readout. Color-coded rate tiers (red/yellow/green) reflect the driver's actual cost
- **Interactive map** — MapLibre + Protomaps route visualization with road-following polylines (via OpenRouteService), origin/destination markers, and LocationIQ geocoding
- **Guided onboarding** — Step-by-step tour walks new users through the filter bar using Onborda
- **Analytics dashboard** — Track earnings, costs, and profit per lane over time
- **Mobile experience** — Uber-inspired sequential flow with bottom tab navigation, screen stack navigation, and touch-optimized filters

## Architecture

Feature-based module structure designed for cross-platform reuse (web + future React Native):

```
src/
  core/               # Platform-agnostic data layer
    hooks/            # React Query hooks (routes, orders, analytics, settings)
    services/         # API client, auth provider
    types/            # Re-exports from @mwbhtx/haulvisor-core
    utils/            # Pure functions (formatters, map utilities, rate colors)

  features/           # Feature modules
    routes/           # Route search and optimization
      hooks/          # useRecentSearches, useMobileRouteNav
      components/     # RouteCard, RouteMap, SearchForm, RouteInspector
      views/
        desktop/      # DesktopRoutesView, LocationSidebar
        mobile/       # MobileRoutesView + 5 screen components
    orders/           # Order board and detail views
    dashboard/        # Analytics charts and stats
    settings/         # User settings management
    admin/            # Admin panel

  platform/
    web/
      components/
        ui/           # shadcn/ui primitives (Button, Card, Dialog, etc.)
        layouts/      # AppShell (desktop), MobileBottomNav
      hooks/          # useIsMobile

  app/                # Next.js App Router — thin page shells only
```

**Dependency rules:**
- `core/` has no imports from `features/`, `platform/`, or `app/`
- `features/` can import from `core/` and `platform/web/components/ui/`
- `platform/` can import from `core/` only
- `app/` is the composition layer — imports from everything

## External Services

| Service | Purpose | Free Tier | Env Var |
|---------|---------|-----------|---------|
| [Protomaps](https://protomaps.com) | Map tile rendering | Free (non-commercial) | `NEXT_PUBLIC_PROTOMAPS_API_KEY` |
| [OpenRouteService](https://openrouteservice.org) | Route polylines (driving-hgv) | 2,000 req/day | `NEXT_PUBLIC_ORS_API_KEY` |
| [LocationIQ](https://locationiq.com) | Geocoding (autocomplete + reverse) | 5,000 req/day | `NEXT_PUBLIC_LOCATIONIQ_KEY` |

## Related Repos

| Repo | Purpose |
|------|---------|
| [haulvisor-core](https://github.com/mwbhtx/haulvisor-core) | Shared types, constants, cost model |
| [haulvisor-backend](https://github.com/mwbhtx/haulvisor-backend) | NestJS API + Lambda functions |

## Development

```bash
npm install
npm run dev        # Starts on localhost:3001
```

Requires the API running on `localhost:3100` (proxied via Next.js rewrites). Also requires a `GITHUB_TOKEN` env var for pulling `@mwbhtx/haulvisor-core` from GitHub Packages (see `.npmrc`).

For local haulvisor-core development, run `npm run dev` in the [haulvisor-core](https://github.com/mwbhtx/haulvisor-core) repo — it watches for changes, rebuilds `dist/`, and syncs it to `.core/` in this project. Turbopack's `resolveAlias` in `next.config.ts` redirects `@mwbhtx/haulvisor-core` imports to `.core/` when it exists, so changes hot reload instantly. In CI (where `.core/` doesn't exist), imports resolve from `node_modules` as normal.

## License

Proprietary
