# Search Radius Filter — Replace Deadhead % with Origin/Destination Radius

**Date:** 2026-04-05
**Status:** Approved

## Goal

Replace the `max_deadhead_pct` filter with origin and destination search radii (in miles). This eliminates the cascading deadhead filtering issues that prevent multi-order routes from appearing, and aligns with how drivers actually think about load accessibility.

## Parameters

| Parameter | Type | Default | Range | Persisted | Sent to API |
|-----------|------|---------|-------|-----------|-------------|
| `origin_radius_miles` | number | 100 | 1–1,000 | No (per-search, resets on refresh) | Always |
| `dest_radius_miles` | number | 100 | 1–1,000 | No (per-search, resets on refresh) | Only when destination is set |

## Behavior

| Setting | Effect |
|---------|--------|
| Origin radius = 100 | First-leg candidates must have pickup within 100 miles of origin |
| Destination set, radius = 100 | Last order's delivery must be within 100 miles of destination |
| No destination set | No constraint on where the route ends |

## What Gets Removed

- `max_deadhead_pct` from user settings (backend settings service + DTO)
- `max_deadhead_pct` from search params / route search DTO
- `DEFAULT_MAX_DEADHEAD_PCT`, `MIN_DEADHEAD_PCT`, `MAX_DEADHEAD_PCT` from haulvisor-core
- The "Max Deadhead %" slider from the frontend filter UI
- All deadhead filtering logic in `route-search.service.ts` (both the distance matrix pruning and the post-evaluation filter)
- `max_deadhead_pct` from `SearchConfig` in `route-search.engine.ts`

## What Stays

- `deadhead_pct` and `total_deadhead_miles` displayed on route cards (informational, not filtered)
- Per-leg `deadhead_miles` displayed on route detail
- Deadhead cost factored into profit calculation (unchanged)

## SQL Changes

### First-leg candidates (tier query)

Add hard geographic filter:
```sql
AND ST_DWithin(origin_point, ST_MakePoint($lng, $lat)::geography, $origin_radius_meters)
```

This replaces the old proximity-based deadhead calculation for candidate filtering. The tier system (T1–T4) stays for diverse ranking within the radius.

### Destination constraint

When destination is set, add to both single-order and multi-order queries:
```sql
AND ST_DWithin(dest_point, ST_MakePoint($dest_lng, $dest_lat)::geography, $dest_radius_meters)
```

For multi-order routes, this applies only to second-leg candidates (the last order must deliver within the destination radius).

### Distance matrix

Remove the `maxDhPct` pruning from `buildDistanceMatrix`. Origin→pickup pairs are already filtered by radius in SQL. Between-leg pairs keep the existing pruning (which uses haversine and is necessary to keep the matrix size manageable for OR-Tools).

## Frontend Changes

### Filter UI (`search-form.tsx`)

Replace the "Max Deadhead %" slider with two inputs:

- **Origin Radius** — number input with "mi" suffix, default 100, range 1–1,000
- **Destination Radius** — number input with "mi" suffix, default 100, range 1–1,000. Only shown when destination is set.

### Search params (`use-routes.ts`)

Add `origin_radius_miles` and `dest_radius_miles` to `RouteSearchParams`. Remove `max_deadhead_pct`.

### Settings (`use-settings.ts`)

Remove `max_deadhead_pct` from the `Settings` interface.

## Backend Changes

### Route search DTO

Add `origin_radius_miles` (number, optional, default 100) and `dest_radius_miles` (number, optional, default 100). Remove `max_deadhead_pct`.

### Search config (`route-search.engine.ts`)

Replace `max_deadhead_pct` in `SearchConfig` with `origin_radius_miles` and `dest_radius_miles`.

### Search service (`route-search.service.ts`)

- Pass radius values to SQL query builder
- Remove the post-evaluation deadhead filter entirely
- Remove `maxDhPct` from `buildDistanceMatrix` (origin pairs already filtered by SQL)
- Keep between-leg distance matrix pruning but remove the deadhead % logic — use a flat distance cap instead (e.g., 500 miles max between-leg deadhead for matrix size control)

### Settings service

Remove `max_deadhead_pct` from settings update handling.

## Repos Affected

| Repo | Changes |
|------|---------|
| haulvisor-core | Remove deadhead constants, add radius defaults |
| haulvisor-backend | Search DTO, engine, service, SQL, settings |
| haulvisor (frontend) | Search form UI, route search params, settings type |
