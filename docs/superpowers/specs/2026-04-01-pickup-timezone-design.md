# Per-Stopoff Timezone & Dual Date Fields

**Date:** 2026-04-01
**Repos affected:** haulvisor-mercer, haulvisor-backend, haulvisor (frontend)
**Status:** Approved — pending implementation

---

## Problem

Mercer stores pickup and delivery times in the local timezone of each location. The scraper (`parseMercerDate`) was appending `Z` to these times, falsely labelling them as UTC. This caused:

1. **Frontend times wrong** — an 8:00 AM Central pickup renders as 3:00 AM or 6:00 AM depending on the user's browser timezone
2. **Staleness check wrong** — comparing a mislabelled "UTC" time against real UTC `now` produces incorrect results by up to 7+ hours
3. **No timezone context** — no way to correctly convert times for backend comparisons

---

## Design

### Core Principle

Store times **twice**: once as the naive local string exactly as Mercer shows it (`_local`), and once as a true UTC ISO string (`_utc`). The `iana_timezone` on each stopoff bridges the two. Frontend always reads `_local`. Backend comparisons always read `_utc`.

---

### Data Schema

#### Stopoff fields (per stopoff in the `stopoffs[]` array)

| Field | Type | Notes |
|---|---|---|
| `early_date_local` | `string` | Naive local, no Z — e.g. `"2026-04-01T08:00:00"` |
| `late_date_local` | `string` | Naive local, no Z |
| `early_date_utc` | `string \| null` | True UTC ISO — null until geocoding resolves timezone |
| `late_date_utc` | `string \| null` | True UTC ISO — null until geocoding resolves timezone |
| `iana_timezone` | `string \| null` | e.g. `"America/Chicago"` — null until geocoding runs |

#### Flat order fields (materialized from first pickup / last dropoff stopoffs)

First pickup = `stopoffs.find(s => s.type === 'pickup')`
Last dropoff = `[...stopoffs].reverse().find(s => s.type === 'dropoff')`

| Old field | New field |
|---|---|
| `pickup_date_early` | `pickup_date_early_utc` |
| `pickup_date_late` | `pickup_date_late_utc` |
| `delivery_date_early` | `delivery_date_early_utc` |
| `delivery_date_late` | `delivery_date_late_utc` |
| *(new)* | `pickup_date_early_local` |
| *(new)* | `pickup_date_late_local` |
| *(new)* | `delivery_date_early_local` |
| *(new)* | `delivery_date_late_local` |

Flat fields exist because:
- Route search SQL runs time math against them in PostgreSQL (`pickup_date_late_utc >= to_timestamp(...)`)
- Stale order check projects them from DynamoDB without fetching full stopoffs array
- API response carries them on `RouteLeg` objects without shipping the full stopoffs array

---

### Data Flow

#### 1. Scrape time (`normalize.ts` — haulvisor-mercer)

- `parseMercerDate` drops the fake `Z` — stores `"2026-04-01T08:00:00"` (naive local)
- Writes `early_date_local`, `late_date_local` to each stopoff
- Writes `pickup_date_early_local`, `pickup_date_late_local`, `delivery_date_early_local`, `delivery_date_late_local` as flat fields
- All `_utc` fields and `iana_timezone` are **null at this point**

#### 2. Geocoding time (`geocoding-worker` — haulvisor-backend)

- Resolves `origin_lat/lng` and `destination_lat/lng` from order flat fields (existing behaviour)
- **New**: fetches the order's full `stopoffs[]` array from DynamoDB
- For each stopoff: geocodes `city + state` via the Mapbox cache (no new API calls if already cached) to get lat/lng
- Calls `geo-tz` with stopoff coordinates → `iana_timezone`
- Converts `early_date_local` + `iana_timezone` → `early_date_utc`, same for `late_date`
- Writes updated stopoffs array (with `iana_timezone`, `early_date_utc`, `late_date_utc`) back to DynamoDB
- Re-materializes the four flat `_utc` fields from first pickup / last dropoff stopoffs
- Updates PostgreSQL `orders` table with the `_utc` flat fields
- If `geo-tz` returns no result (bad coords, edge case): logs warning, leaves `iana_timezone` and `_utc` fields null for that stopoff — no crash

#### 3. Staleness check (`stale-orders.ts` — haulvisor-mercer)

- Uses `pickup_date_late_utc` instead of `pickup_date_early`
- Compares directly against `now` UTC — no runtime conversion needed
- Skips orders where `pickup_date_late_utc` is null (timezone not yet resolved)
- First pickup's late window is the staleness signal — order is stale when first pickup's late window has passed

#### 4. Frontend display (haulvisor)

- All date display reads `*_local` fields — renders `"08:00 AM"` as-is, matches Mercer exactly
- Route detail panel (desktop) and detail screen (mobile): replaced with full `stopoffs[]` iteration — renders every stop with type, company name, city/state, early/late local window
- Orders table and order summary card: continue using flat `_local` fields for the summary row
- Never reads `_utc` fields for display

---

### PostgreSQL Migration

```sql
-- Rename existing columns
ALTER TABLE orders RENAME COLUMN pickup_date_early TO pickup_date_early_utc;
ALTER TABLE orders RENAME COLUMN pickup_date_late TO pickup_date_late_utc;
ALTER TABLE orders RENAME COLUMN delivery_date_early TO delivery_date_early_utc;
ALTER TABLE orders RENAME COLUMN delivery_date_late TO delivery_date_late_utc;

-- Add local variants
ALTER TABLE orders ADD COLUMN pickup_date_early_local TEXT;
ALTER TABLE orders ADD COLUMN pickup_date_late_local TEXT;
ALTER TABLE orders ADD COLUMN delivery_date_early_local TEXT;
ALTER TABLE orders ADD COLUMN delivery_date_late_local TEXT;
```

The `dynamo-to-pg-orders-stream` lambda maps the renamed fields.

---

### haulvisor-core Type Updates

`Stopoff`, `Order`, and `RouteLeg` types updated to reflect new field names and add `iana_timezone`.

---

### Backfill Script

**Location:** `haulvisor-backend/scripts/backfill-stopoff-timezones.ts`

**Scope:** Mercer company (`company_id = "b08807e8-d0c2-4784-be44-fd27b75b5d07"`), `order_status = "open"`, `origin_lat` exists, `pickup_date_early_utc` is null.

**Process:**
1. Paginated DynamoDB query with above filters
2. For each order, iterate `stopoffs[]`
3. Per stopoff: look up coordinates from the geocode cache table (city + state key) — no new Mapbox calls
4. Call `geo-tz` with coordinates → `iana_timezone`
5. Convert `early_date_local` / `late_date_local` → UTC using timezone
6. Write updated stopoffs, `iana_timezone`, and all `_utc` flat fields back to DynamoDB
7. Write `_utc` flat fields directly to PostgreSQL (bypasses stream — one-time migration)

**Safety:** `--dry-run` flag logs intended writes without committing.

---

### Library

**`geo-tz`** — maps lat/lng → IANA timezone string using local tzdata boundary data. No external API. Added to `geocoding-worker` dependencies and backfill script.

---

## Multi-Company Compatibility

Future companies that send UTC timestamps natively:
- Write `*_utc` fields directly at ingest time
- Write `*_local` fields if timezone is known; null otherwise
- Frontend falls back to displaying `_utc` with a timezone label if `_local` is null

---

## Out of Scope

- Route search SQL for subsequent stopoffs (driver reachability to first pickup is sufficient; subsequent stops assumed reachable once first is reached)
- Timezone display labels in the UI (e.g. "8:00 AM CT") — follow-on work
- Closed/completed order backfill — no value
