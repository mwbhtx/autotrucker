# Per-Stopoff Timezone & Dual Date Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store pickup/delivery times as both naive local strings (as Mercer shows them) and true UTC timestamps per stopoff, enabling correct staleness checks and frontend display that matches Mercer exactly.

**Architecture:** `parseMercerDate` stops faking UTC; scraper writes `*_local` fields immediately. The geocoding worker resolves IANA timezone per stopoff via `geo-tz`, then converts to `*_utc`. DynamoDB stream syncs UTC flat fields to PostgreSQL. Frontend reads `*_local` for display; backend SQL and staleness check read `*_utc`.

**Tech Stack:** TypeScript, `geo-tz` (lat/lng → IANA timezone, no external API), `luxon` (local string + timezone → UTC), DynamoDB, PostgreSQL/PostGIS, NestJS, Next.js

**Dependency order:** Task 1 (core types) → Task 2 (publish core) → Tasks 3–4 (mercer scraper + stale) → Task 5 (postgres migration) → Task 6 (stream lambda) → Task 7 (route search API) → Task 8 (geocoding worker) → Task 9 (backfill script) → Task 10 (frontend)

---

## File Map

| File | Change |
|---|---|
| `haulvisor-core/src/types/order.ts` | Rename `early_date`/`late_date` → `*_local`/`*_utc`, add `iana_timezone`; rename flat `Order` fields |
| `haulvisor-core/src/types/routes.ts` | Rename flat `RouteLeg` date fields |
| `haulvisor-mercer/lambdas/order-details-scraper/src/normalize.ts` | `parseMercerDate` drops fake Z; use new field names |
| `haulvisor-mercer/lambdas/order-details-scraper/src/__tests__/normalize.spec.ts` | Update tests for new field names and local date format |
| `haulvisor-mercer/lambdas/stale-order-refresh/src/stale-orders.ts` | Use `pickup_date_late_utc`; compare against real `now` UTC |
| `haulvisor-mercer/lambdas/stale-order-refresh/src/__tests__/stale-orders.spec.ts` | Update tests |
| `haulvisor-backend/scripts/migrate-postgres.ts` | Rename 4 date columns; add 4 `_local` columns |
| `haulvisor-backend/lambdas/dynamo-to-pg-orders-stream/src/field-mapper.ts` | Add new field mappings |
| `haulvisor-backend/lambdas/dynamo-to-pg-orders-stream/src/handler.ts` | Update INSERT/UPDATE SQL for renamed + new columns |
| `haulvisor-backend/api/src/routes/route-search.sql.ts` | Rename `pickup_date_*` → `*_utc` in SQL |
| `haulvisor-backend/api/src/routes/route-search.engine.ts` | Rename date fields on `OrderRow` + leg mapping |
| `haulvisor-backend/api/src/routes/route-search.service.ts` | Rename date fields in leg mapping |
| `haulvisor-backend/api/src/orders/orders.service.ts` | Add new field names to `ORDER_FIELDS` allowlist |
| `haulvisor-backend/lambdas/geocoding-worker/package.json` | Add `geo-tz`, `luxon` dependencies |
| `haulvisor-backend/lambdas/geocoding-worker/src/handler.ts` | Add stopoff timezone resolution + UTC conversion |
| `haulvisor-backend/lambdas/geocoding-worker/src/handler.spec.ts` | Update tests |
| `haulvisor-backend/scripts/backfill-stopoff-timezones.ts` | New one-time script |
| `haulvisor/src/features/orders/components/orders-table.tsx` | Use `pickup_date_early_local` |
| `haulvisor/src/features/orders/components/order-summary-card.tsx` | Use `pickup_date_*_local` |
| `haulvisor/src/features/routes/views/desktop/location-sidebar.tsx` | Use `*_local` fields |
| `haulvisor/src/features/routes/views/desktop/route-detail-panel.tsx` | Use `*_local`; render all stopoffs |
| `haulvisor/src/features/routes/views/mobile/screens/detail-screen.tsx` | Use `*_local`; render all stopoffs |

---

## Task 1: Update haulvisor-core Types

**Repo:** `haulvisor-core`

**Files:**
- Modify: `src/types/order.ts`
- Modify: `src/types/routes.ts`

- [ ] **Step 1: Update `Stopoff` interface**

Replace the contents of `src/types/order.ts`:

```typescript
export interface Stopoff {
  sequence: number;
  type: 'pickup' | 'dropoff';
  company_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
  /** Local time as shown by the source system — naive, no timezone marker */
  early_date_local: string;
  /** Local time as shown by the source system — naive, no timezone marker */
  late_date_local: string;
  /** True UTC ISO string — null until geocoding resolves the timezone */
  early_date_utc: string | null;
  /** True UTC ISO string — null until geocoding resolves the timezone */
  late_date_utc: string | null;
  /** IANA timezone of this stop location — null until geocoding runs */
  iana_timezone: string | null;
  contact_phone?: string;
}

export interface Order {
  company_id: string;
  order_id: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  /** Local time of first pickup — naive, no timezone marker */
  pickup_date_early_local?: string;
  /** Local time of first pickup — naive, no timezone marker */
  pickup_date_late_local?: string;
  /** UTC time of first pickup — null until geocoding resolves timezone */
  pickup_date_early_utc?: string | null;
  /** UTC time of first pickup — null until geocoding resolves timezone */
  pickup_date_late_utc?: string | null;
  /** Local time of last delivery — naive, no timezone marker */
  delivery_date_early_local?: string;
  /** Local time of last delivery — naive, no timezone marker */
  delivery_date_late_local?: string;
  /** UTC time of last delivery — null until geocoding resolves timezone */
  delivery_date_early_utc?: string | null;
  /** UTC time of last delivery — null until geocoding resolves timezone */
  delivery_date_late_utc?: string | null;
  pay: number;
  miles: number;
  rate_per_mile: number;
  weight: number;
  trailer_type: string;
  ltl: boolean;
  twic: boolean;
  team_load: boolean;
  first_seen?: string;
  last_seen?: string;
  has_details?: boolean;
  order_status?: 'open' | 'closed';
  order_status_history?: { order_status: 'open' | 'closed'; timestamp: string }[];
  agent_phone?: string;
  commodity?: string;
  hazmat?: boolean;
  ramps_required?: boolean;
  tarp_height?: string;
  feet_remaining?: string;
  top_100_customer?: boolean;
  comments?: string;
  stopoffs?: Stopoff[];
}

export interface PaginatedOrders {
  items: Order[];
  lastKey?: string;
  count: number;
}
```

- [ ] **Step 2: Update `RouteLeg` interface**

Replace the date fields in `src/types/routes.ts`:

```typescript
import type { RouteCostBreakdown } from './scoring.js';
import type { TripPhase, TripSimulationSummary } from '../trip-simulator.js';

export interface RouteLeg {
  leg_number: number;
  order_id: string;
  origin_city: string;
  origin_state: string;
  origin_lat: number;
  origin_lng: number;
  destination_city: string;
  destination_state: string;
  destination_lat: number;
  destination_lng: number;
  pay: number;
  miles: number;
  trailer_type?: string;
  deadhead_miles: number;
  weight?: number;
  pickup_date_early_local?: string;
  pickup_date_late_local?: string;
  pickup_date_early_utc?: string | null;
  pickup_date_late_utc?: string | null;
  delivery_date_early_local?: string;
  delivery_date_late_local?: string;
  delivery_date_early_utc?: string | null;
  delivery_date_late_utc?: string | null;
  stopoffs?: import('./order.js').Stopoff[];
  lane_rank?: number;
  tarp_height?: string;
}

export interface RouteChain {
  rank: number;
  total_pay: number;
  total_miles: number;
  total_deadhead_miles: number;
  estimated_deadhead_cost: number;
  profit: number;
  rate_per_mile: number;
  legs: RouteLeg[];
  deadhead_pct: number;
  effective_rpm: number;
  estimated_days: number;
  daily_net_profit: number;
  cost_breakdown: RouteCostBreakdown;
  timeline?: TripPhase[];
  trip_summary?: TripSimulationSummary;
  suggested_departure?: string;
}

export interface RouteSearchResult {
  routes: RouteChain[];
  origin: {
    city: string;
    state: string;
    lat: number;
    lng: number;
  };
  order_url_template?: string;
}
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-core
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-core
git add src/types/order.ts src/types/routes.ts
git commit -m "feat: per-stopoff timezone — dual date fields on Stopoff, Order, RouteLeg"
```

---

## Task 2: Publish haulvisor-core and Update Consumers

**Repo:** `haulvisor-core`, then `haulvisor-mercer`, `haulvisor-backend`, `haulvisor`

- [ ] **Step 1: Push to main to trigger CI publish**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-core
git push origin main
```

Wait ~2 minutes for CI to publish a new version to GitHub Packages.

- [ ] **Step 2: Update consumers**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer && npm update @mwbhtx/haulvisor-core
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend && npm update @mwbhtx/haulvisor-core
cd /Users/matthewbennett/Documents/GitHub/haulvisor && npm update @mwbhtx/haulvisor-core
```

- [ ] **Step 3: Verify TypeScript in each consumer compiles (errors expected — fix in subsequent tasks)**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend/api && npx tsc --noEmit 2>&1 | head -30
cd /Users/matthewbennett/Documents/GitHub/haulvisor && npx tsc --noEmit 2>&1 | head -30
```

This will show which files reference the old field names — use this list to guide remaining tasks. Do not fix errors yet.

---

## Task 3: Fix normalize.ts — Drop Fake Z, Use New Field Names

**Repo:** `haulvisor-mercer`

**Files:**
- Modify: `lambdas/order-details-scraper/src/normalize.ts`
- Modify: `lambdas/order-details-scraper/src/__tests__/normalize.spec.ts`

- [ ] **Step 1: Update the failing tests first**

Replace `lambdas/order-details-scraper/src/__tests__/normalize.spec.ts`:

```typescript
import { parseMercerDate, toNormalizedOrder } from '../normalize';
import type { OrderDetails } from '../parser';

describe('parseMercerDate', () => {
  it('parses MM/DD/YYYY to naive local ISO string without Z', () => {
    expect(parseMercerDate('03/30/2026')).toBe('2026-03-30T00:00:00');
  });

  it('parses MM/DD/YYYY HH:mm to naive local ISO string without Z', () => {
    expect(parseMercerDate('03/30/2026 06:00')).toBe('2026-03-30T06:00:00');
  });

  it('returns undefined for empty/null input', () => {
    expect(parseMercerDate(undefined)).toBeUndefined();
    expect(parseMercerDate('')).toBeUndefined();
    expect(parseMercerDate('   ')).toBeUndefined();
  });

  it('returns undefined for unparseable input', () => {
    expect(parseMercerDate('not a date')).toBeUndefined();
  });
});

describe('toNormalizedOrder', () => {
  const baseDetails: OrderDetails = {
    order_id: 'E999999',
    trip_number: '1',
    dispatched_unit: '',
    dispatched_driver: '',
    tarp_height: '',
    miles: 500,
    trailer_type: 'V',
    pieces: '1',
    pay: 1500,
    pay_per_mile: 3.0,
    weight: '40000',
    hazmat: false,
    ltl: false,
    team_load: false,
    truck_rev_adjustment: '',
    feet_remaining: '',
    top_100_customer: false,
    booked_status: '',
    twic: false,
    commodity: 'General',
    agent_phone: '555-1234',
    ramps_required: false,
    coordinator: '',
    reference_number: '',
    driver_phone: '',
    created_by: '',
    comments: [],
    stopoffs: [],
  };

  it('handles single pickup + single dropoff — new field names, no Z', () => {
    const details: OrderDetails = {
      ...baseDetails,
      stopoffs: [
        {
          type: 'Pickup', company_name: 'TBD', address_1: 'N/A', address_2: 'N/A',
          city: 'HOUSTON', state: 'TX', zip: '77052',
          early_date: '03/30/2026 06:00', late_date: '03/30/2026 13:00', contact_phone: '',
        },
        {
          type: 'Dropoff', company_name: 'TBD', address_1: 'N/A', address_2: 'N/A',
          city: 'JACKSON', state: 'NH', zip: '03846',
          early_date: '04/01/2026 08:00', late_date: '04/02/2026 14:00', contact_phone: '',
        },
      ],
    };

    const result = toNormalizedOrder(details);

    expect(result.stopoffs).toHaveLength(2);
    expect((result.stopoffs as any[])[0]).toMatchObject({
      sequence: 0,
      type: 'pickup',
      city: 'HOUSTON',
      early_date_local: '2026-03-30T06:00:00',
      late_date_local: '2026-03-30T13:00:00',
      early_date_utc: null,
      late_date_utc: null,
      iana_timezone: null,
    });
    expect((result.stopoffs as any[])[1]).toMatchObject({
      sequence: 1,
      type: 'dropoff',
      city: 'JACKSON',
      early_date_local: '2026-04-01T08:00:00',
      late_date_local: '2026-04-02T14:00:00',
      early_date_utc: null,
      late_date_utc: null,
      iana_timezone: null,
    });

    // flat local fields
    expect(result.pickup_date_early_local).toBe('2026-03-30T06:00:00');
    expect(result.pickup_date_late_local).toBe('2026-03-30T13:00:00');
    expect(result.delivery_date_early_local).toBe('2026-04-01T08:00:00');
    expect(result.delivery_date_late_local).toBe('2026-04-02T14:00:00');
    // flat utc fields start null
    expect(result.pickup_date_early_utc).toBeNull();
    expect(result.pickup_date_late_utc).toBeNull();
    expect(result.delivery_date_early_utc).toBeNull();
    expect(result.delivery_date_late_utc).toBeNull();
  });

  it('handles multi-pickup — flat fields from FIRST pickup only', () => {
    const details: OrderDetails = {
      ...baseDetails,
      stopoffs: [
        {
          type: 'Pickup', company_name: 'TBD', address_1: 'N/A', address_2: 'N/A',
          city: 'HOUSTON', state: 'TX', zip: '77052',
          early_date: '03/30/2026 06:00', late_date: '03/30/2026 13:00', contact_phone: '',
        },
        {
          type: 'Pickup', company_name: 'TBD', address_1: 'N/A', address_2: 'N/A',
          city: 'OKLAHOMA CITY', state: 'OK', zip: '73102',
          early_date: '03/31/2026 08:00', late_date: '04/01/2026 16:00', contact_phone: '',
        },
        {
          type: 'Dropoff', company_name: 'TBD', address_1: 'N/A', address_2: 'N/A',
          city: 'JACKSON', state: 'NH', zip: '03846',
          early_date: '04/02/2026 08:00', late_date: '04/03/2026 14:00', contact_phone: '',
        },
      ],
    };

    const result = toNormalizedOrder(details);

    expect(result.pickup_date_early_local).toBe('2026-03-30T06:00:00');
    expect(result.pickup_date_late_local).toBe('2026-03-30T13:00:00');
    expect(result.delivery_date_early_local).toBe('2026-04-02T08:00:00');
    expect(result.delivery_date_late_local).toBe('2026-04-03T14:00:00');
  });

  it('handles multi-dropoff — flat fields from LAST dropoff', () => {
    const details: OrderDetails = {
      ...baseDetails,
      stopoffs: [
        {
          type: 'Pickup', company_name: 'TBD', address_1: 'N/A', address_2: 'N/A',
          city: 'HOUSTON', state: 'TX', zip: '77052',
          early_date: '03/30/2026 06:00', late_date: '03/30/2026 13:00', contact_phone: '',
        },
        {
          type: 'Dropoff', company_name: 'TBD', address_1: 'N/A', address_2: 'N/A',
          city: 'MEMPHIS', state: 'TN', zip: '38103',
          early_date: '04/01/2026 07:00', late_date: '04/01/2026 17:00', contact_phone: '',
        },
        {
          type: 'Dropoff', company_name: 'TBD', address_1: 'N/A', address_2: 'N/A',
          city: 'JACKSON', state: 'NH', zip: '03846',
          early_date: '04/02/2026 08:00', late_date: '04/03/2026 14:00', contact_phone: '',
        },
      ],
    };

    const result = toNormalizedOrder(details);

    expect(result.delivery_date_early_local).toBe('2026-04-02T08:00:00');
    expect(result.delivery_date_late_local).toBe('2026-04-03T14:00:00');
  });

  it('handles no stopoffs gracefully', () => {
    const result = toNormalizedOrder(baseDetails);
    expect(result.stopoffs).toBeUndefined();
    expect(result.pickup_date_early_local).toBeUndefined();
    expect(result.delivery_date_early_local).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper
npm test 2>&1 | tail -20
```

Expected: failures about `early_date_local` not existing, `parseMercerDate` returning wrong format.

- [ ] **Step 3: Update `normalize.ts`**

Replace the full file:

```typescript
import type { OrderDetails } from './parser.js';

const COMPANY_ID = process.env.COMPANY_ID || 'mercer-local-dev';

/**
 * Parse Mercer date format (MM/DD/YYYY or MM/DD/YYYY HH:mm) to a naive local
 * ISO string WITHOUT a timezone marker — "2026-04-01T08:00:00".
 *
 * Mercer stores times in the local timezone of the pickup/delivery location.
 * We do NOT append Z here — that would falsely imply UTC.
 * The geocoding worker resolves the IANA timezone later and derives the UTC value.
 */
export function parseMercerDate(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return undefined;
  const [, month, day, year, hours, minutes] = match;
  return `${year}-${month}-${day}T${hours ?? '00'}:${minutes ?? '00'}:00`;
}

/** Normalize raw stopoff type string to constrained union */
function normalizeStopoffType(raw: string): 'pickup' | 'dropoff' {
  const lower = raw.toLowerCase();
  if (lower === 'pickup') return 'pickup';
  return 'dropoff';
}

/** Map scraped OrderDetails to normalized Order fields for the haulvisor API */
export function toNormalizedOrder(details: OrderDetails): Record<string, unknown> {
  if (details.stopoffs.length === 0) {
    return {
      company_id: COMPANY_ID,
      order_id: details.order_id,
      has_details: true,
      tarp_height: details.tarp_height || undefined,
      commodity: details.commodity || undefined,
      hazmat: details.hazmat,
      ramps_required: details.ramps_required,
      feet_remaining: details.feet_remaining || undefined,
      top_100_customer: details.top_100_customer,
      agent_phone: details.agent_phone || undefined,
      comments: details.comments.length > 0 ? details.comments.join('\n') : undefined,
    };
  }

  const normalizedStopoffs = details.stopoffs.map((s, i) => ({
    sequence: i,
    type: normalizeStopoffType(s.type),
    company_name: s.company_name,
    address_1: s.address_1,
    address_2: s.address_2 || undefined,
    city: s.city,
    state: s.state,
    zip: s.zip,
    early_date_local: parseMercerDate(s.early_date) ?? s.early_date,
    late_date_local: parseMercerDate(s.late_date) ?? s.late_date,
    early_date_utc: null,
    late_date_utc: null,
    iana_timezone: null,
    contact_phone: s.contact_phone || undefined,
  }));

  const firstPickup = normalizedStopoffs.find(s => s.type === 'pickup');
  const lastDropoff = [...normalizedStopoffs].reverse().find(s => s.type === 'dropoff');

  return {
    company_id: COMPANY_ID,
    order_id: details.order_id,
    has_details: true,
    tarp_height: details.tarp_height || undefined,
    commodity: details.commodity || undefined,
    hazmat: details.hazmat,
    ramps_required: details.ramps_required,
    feet_remaining: details.feet_remaining || undefined,
    top_100_customer: details.top_100_customer,
    agent_phone: details.agent_phone || undefined,
    comments: details.comments.length > 0 ? details.comments.join('\n') : undefined,
    stopoffs: normalizedStopoffs,
    ...(firstPickup ? {
      pickup_date_early_local: firstPickup.early_date_local,
      pickup_date_late_local: firstPickup.late_date_local,
      pickup_date_early_utc: null,
      pickup_date_late_utc: null,
    } : {}),
    ...(lastDropoff ? {
      delivery_date_early_local: lastDropoff.early_date_local,
      delivery_date_late_local: lastDropoff.late_date_local,
      delivery_date_early_utc: null,
      delivery_date_late_utc: null,
    } : {}),
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer
git add lambdas/order-details-scraper/src/normalize.ts lambdas/order-details-scraper/src/__tests__/normalize.spec.ts
git commit -m "feat: store pickup/delivery times as naive local strings, add _utc placeholders"
```

---

## Task 4: Update Stale Order Check

**Repo:** `haulvisor-mercer`

**Files:**
- Modify: `lambdas/stale-order-refresh/src/stale-orders.ts`
- Modify: `lambdas/stale-order-refresh/src/__tests__/stale-orders.spec.ts`

- [ ] **Step 1: Write the failing test**

Replace `lambdas/stale-order-refresh/src/__tests__/stale-orders.spec.ts`:

```typescript
import { filterStaleOrderIds } from '../stale-orders';

describe('filterStaleOrderIds', () => {
  const today = '2026-04-01T15:00:00.000Z'; // 3PM UTC

  it('returns order IDs where pickup_date_late_utc is before now', () => {
    const items = [
      { order_id: 'A1', order_status: 'open', pickup_date_late_utc: '2026-04-01T13:00:00.000Z' }, // expired
      { order_id: 'A2', order_status: 'open', pickup_date_late_utc: '2026-04-01T20:00:00.000Z' }, // not yet expired
      { order_id: 'A3', order_status: 'open', pickup_date_late_utc: '2026-03-31T23:59:00.000Z' }, // yesterday, expired
    ];
    expect(filterStaleOrderIds(items, today)).toEqual(['A1', 'A3']);
  });

  it('skips orders with null pickup_date_late_utc (timezone not yet resolved)', () => {
    const items = [
      { order_id: 'B1', order_status: 'open', pickup_date_late_utc: null },
      { order_id: 'B2', order_status: 'open', pickup_date_late_utc: '2026-03-31T10:00:00.000Z' },
    ];
    expect(filterStaleOrderIds(items, today)).toEqual(['B2']);
  });

  it('skips orders that are not open', () => {
    const items = [
      { order_id: 'C1', order_status: 'closed', pickup_date_late_utc: '2026-03-31T10:00:00.000Z' },
      { order_id: 'C2', order_status: 'open', pickup_date_late_utc: '2026-03-31T10:00:00.000Z' },
    ];
    expect(filterStaleOrderIds(items, today)).toEqual(['C2']);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/stale-order-refresh
npm test 2>&1 | tail -20
```

Expected: failures — `pickup_date_late_utc` not referenced, old logic.

- [ ] **Step 3: Update `stale-orders.ts`**

Replace the full file:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ORDERS_TABLE = process.env.ORDERS_TABLE ?? 'haulvisor-orders';
const COMPANY_ID = process.env.COMPANY_ID ?? 'mercer-local-dev';

const client = new DynamoDBClient({
  ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

interface OrderItem {
  order_id: string;
  order_status?: string;
  pickup_date_late_utc?: string | null;
}

/**
 * Pure filtering function — given a list of order items and now as an ISO UTC string,
 * returns the order IDs that are open and whose first pickup late window has passed.
 *
 * Orders with null pickup_date_late_utc are skipped (timezone not yet resolved by geocoder).
 */
export function filterStaleOrderIds(items: OrderItem[], nowUtc: string): string[] {
  return items
    .filter((item) =>
      item.order_status === 'open' &&
      item.pickup_date_late_utc != null &&
      item.pickup_date_late_utc < nowUtc
    )
    .map((item) => item.order_id);
}

/**
 * Query all open orders for the company and return those with expired pickup late windows.
 */
export async function getStaleOrderIds(nowUtc: string): Promise<string[]> {
  const allItems: OrderItem[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        KeyConditionExpression: 'company_id = :cid',
        FilterExpression: 'order_status = :open',
        ExpressionAttributeValues: {
          ':cid': COMPANY_ID,
          ':open': 'open',
        },
        ProjectionExpression: 'order_id, order_status, pickup_date_late_utc',
        ExclusiveStartKey: lastKey,
      }),
    );
    allItems.push(...((result.Items as OrderItem[]) ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return filterStaleOrderIds(allItems, nowUtc);
}
```

- [ ] **Step 4: Update `index.ts` to pass `now.toISOString()` instead of a date string**

In `lambdas/stale-order-refresh/src/index.ts`, update the call to `getStaleOrderIds`:

```typescript
// Replace:
const todayStr = now.toLocaleDateString('en-CA', {
  timeZone: company.stale_order_refresh_config.timezone,
});
const staleOrderIds = await getStaleOrderIds(todayStr);

// With:
const staleOrderIds = await getStaleOrderIds(now.toISOString());
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/stale-order-refresh
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer
git add lambdas/stale-order-refresh/src/stale-orders.ts lambdas/stale-order-refresh/src/__tests__/stale-orders.spec.ts lambdas/stale-order-refresh/src/index.ts
git commit -m "feat: stale check uses pickup_date_late_utc compared against real UTC now"
```

---

## Task 5: PostgreSQL Migration

**Repo:** `haulvisor-backend`

**Files:**
- Modify: `scripts/migrate-postgres.ts`

- [ ] **Step 1: Add the column rename + new column migration block**

In `scripts/migrate-postgres.ts`, add a new migration block after the existing `newColumns` loop (before the `order_status_transitions` table creation):

```typescript
// Rename old date columns to _utc variants (idempotent)
console.log('Renaming date columns to _utc variants...');
const dateRenames: Array<{ from: string; to: string }> = [
  { from: 'pickup_date_early',   to: 'pickup_date_early_utc' },
  { from: 'pickup_date_late',    to: 'pickup_date_late_utc' },
  { from: 'delivery_date_early', to: 'delivery_date_early_utc' },
  { from: 'delivery_date_late',  to: 'delivery_date_late_utc' },
];
for (const { from, to } of dateRenames) {
  const { rows: oldExists } = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = $1`,
    [from],
  );
  const { rows: newExists } = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = $1`,
    [to],
  );
  if (oldExists.length > 0 && newExists.length === 0) {
    await client.query(`ALTER TABLE orders RENAME COLUMN ${from} TO ${to}`);
    console.log(`  Renamed: ${from} → ${to}`);
  } else if (newExists.length > 0) {
    console.log(`  Already renamed: ${to}`);
  } else {
    console.log(`  Column ${from} not found — skipping`);
  }
}

// Add _local variants (idempotent via existing newColumns pattern)
const localDateColumns: Array<{ name: string; type: string }> = [
  { name: 'pickup_date_early_local',   type: 'TEXT' },
  { name: 'pickup_date_late_local',    type: 'TEXT' },
  { name: 'delivery_date_early_local', type: 'TEXT' },
  { name: 'delivery_date_late_local',  type: 'TEXT' },
];
for (const col of localDateColumns) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = $1`,
    [col.name],
  );
  if (rows.length === 0) {
    await client.query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type}`);
    console.log(`  Added column: ${col.name}`);
  } else {
    console.log(`  Column already exists: ${col.name}`);
  }
}
```

- [ ] **Step 2: Run migration against local DB**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend/api
npm run db:migrate 2>&1
```

Expected output includes:
```
Renamed: pickup_date_early → pickup_date_early_utc
Renamed: pickup_date_late → pickup_date_late_utc
Renamed: delivery_date_early → delivery_date_early_utc
Renamed: delivery_date_late → delivery_date_late_utc
Added column: pickup_date_early_local
Added column: pickup_date_late_local
Added column: delivery_date_early_local
Added column: delivery_date_late_local
```

Re-running should show "Already renamed" and "Column already exists" for all.

- [ ] **Step 3: Run migration against production DB**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
DB_HOST=<prod-host> DB_PASSWORD=<prod-password> npx tsx scripts/migrate-postgres.ts
```

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add scripts/migrate-postgres.ts
git commit -m "feat: rename date columns to _utc, add _local variants to orders table"
```

---

## Task 6: Update DynamoDB → PostgreSQL Stream Lambda

**Repo:** `haulvisor-backend`

**Files:**
- Modify: `lambdas/dynamo-to-pg-orders-stream/src/field-mapper.ts`
- Modify: `lambdas/dynamo-to-pg-orders-stream/src/handler.ts`

- [ ] **Step 1: Update `field-mapper.ts` — add new fields to `MappedOrder`**

In `field-mapper.ts`, replace the four old date fields with eight new ones in both the `MappedOrder` interface and `mapOrder` function:

```typescript
// In MappedOrder interface, replace:
//   pickup_date_early: string | null;
//   pickup_date_late: string | null;
//   delivery_date_early: string | null;
//   delivery_date_late: string | null;
// With:
  pickup_date_early_utc: string | null;
  pickup_date_late_utc: string | null;
  delivery_date_early_utc: string | null;
  delivery_date_late_utc: string | null;
  pickup_date_early_local: string | null;
  pickup_date_late_local: string | null;
  delivery_date_early_local: string | null;
  delivery_date_late_local: string | null;
```

In `mapOrder`, replace:
```typescript
// Replace:
//   pickup_date_early: str(image, 'pickup_date_early'),
//   pickup_date_late: str(image, 'pickup_date_late'),
//   delivery_date_early: str(image, 'delivery_date_early'),
//   delivery_date_late: str(image, 'delivery_date_late'),
// With:
    pickup_date_early_utc: str(image, 'pickup_date_early_utc'),
    pickup_date_late_utc: str(image, 'pickup_date_late_utc'),
    delivery_date_early_utc: str(image, 'delivery_date_early_utc'),
    delivery_date_late_utc: str(image, 'delivery_date_late_utc'),
    pickup_date_early_local: str(image, 'pickup_date_early_local'),
    pickup_date_late_local: str(image, 'pickup_date_late_local'),
    delivery_date_early_local: str(image, 'delivery_date_early_local'),
    delivery_date_late_local: str(image, 'delivery_date_late_local'),
```

- [ ] **Step 2: Update `handler.ts` — rename columns and add new ones in the SQL**

In `handler.ts`, update the parameter comments, INSERT column list, VALUES, and ON CONFLICT SET. The old params $29–$32 were `pickup_date_early`, `pickup_date_late`, `delivery_date_early`, `delivery_date_late`. Replace with 8 params ($29–$36), then shift `order_status` and subsequent params accordingly.

Replace the entire INSERT query with:

```typescript
async function upsertOrder(pool: Pool, order: MappedOrder): Promise<void> {
  await pool.query(
    `
    INSERT INTO orders (
      company_id, order_id,
      origin_city, origin_state, dest_city, dest_state,
      origin_point, dest_point,
      pay, miles, rate_per_mile, weight, trailer_type, commodity,
      ltl, twic, team_load, has_details, hazmat, ramps_required,
      tarp_height, feet_remaining, top_100_customer, comments, agent_phone,
      stopoffs,
      pickup_date_early_utc, pickup_date_late_utc,
      delivery_date_early_utc, delivery_date_late_utc,
      pickup_date_early_local, pickup_date_late_local,
      delivery_date_early_local, delivery_date_late_local,
      order_status, first_seen, last_seen,
      opened_at, first_opened_at, closed_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      CASE WHEN $7::float IS NOT NULL THEN ST_MakePoint($8::float, $7::float)::geography ELSE NULL END,
      CASE WHEN $9::float IS NOT NULL THEN ST_MakePoint($10::float, $9::float)::geography ELSE NULL END,
      $11, $12, $13, $14, $15, $16, $17, $18, $19,
      $20, $21, $22, $23, $24, $25, $26, $27, $28::jsonb,
      $29, $30, $31, $32, $33, $34, $35, $36,
      $37, $38, $39,
      COALESCE($38::timestamptz, NOW()),
      COALESCE($38::timestamptz, NOW()),
      CASE WHEN $37 = 'closed' THEN COALESCE($39::timestamptz, NOW()) ELSE NULL END
    )
    ON CONFLICT (company_id, order_id) DO UPDATE SET
      origin_city             = EXCLUDED.origin_city,
      origin_state            = EXCLUDED.origin_state,
      dest_city               = EXCLUDED.dest_city,
      dest_state              = EXCLUDED.dest_state,
      origin_point            = EXCLUDED.origin_point,
      dest_point              = EXCLUDED.dest_point,
      pay                     = EXCLUDED.pay,
      miles                   = EXCLUDED.miles,
      rate_per_mile           = EXCLUDED.rate_per_mile,
      weight                  = EXCLUDED.weight,
      trailer_type            = EXCLUDED.trailer_type,
      commodity               = EXCLUDED.commodity,
      ltl                     = EXCLUDED.ltl,
      twic                    = EXCLUDED.twic,
      team_load               = EXCLUDED.team_load,
      has_details             = EXCLUDED.has_details,
      hazmat                  = EXCLUDED.hazmat,
      ramps_required          = EXCLUDED.ramps_required,
      tarp_height             = EXCLUDED.tarp_height,
      feet_remaining          = EXCLUDED.feet_remaining,
      top_100_customer        = EXCLUDED.top_100_customer,
      comments                = EXCLUDED.comments,
      agent_phone             = EXCLUDED.agent_phone,
      stopoffs                = EXCLUDED.stopoffs,
      pickup_date_early_utc   = EXCLUDED.pickup_date_early_utc,
      pickup_date_late_utc    = EXCLUDED.pickup_date_late_utc,
      delivery_date_early_utc = EXCLUDED.delivery_date_early_utc,
      delivery_date_late_utc  = EXCLUDED.delivery_date_late_utc,
      pickup_date_early_local   = EXCLUDED.pickup_date_early_local,
      pickup_date_late_local    = EXCLUDED.pickup_date_late_local,
      delivery_date_early_local = EXCLUDED.delivery_date_early_local,
      delivery_date_late_local  = EXCLUDED.delivery_date_late_local,
      order_status            = EXCLUDED.order_status,
      last_seen               = EXCLUDED.last_seen,
      opened_at               = COALESCE(orders.opened_at, EXCLUDED.opened_at),
      first_opened_at         = COALESCE(orders.first_opened_at, EXCLUDED.first_opened_at)
    `,
    [
      order.company_id,               // $1
      order.order_id,                 // $2
      order.origin_city,              // $3
      order.origin_state,             // $4
      order.dest_city,                // $5
      order.dest_state,               // $6
      order.origin_lat,               // $7
      order.origin_lng,               // $8
      order.dest_lat,                 // $9
      order.dest_lng,                 // $10
      order.pay,                      // $11
      order.miles,                    // $12
      order.rate_per_mile,            // $13
      order.weight,                   // $14
      order.trailer_type,             // $15
      order.commodity,                // $16
      order.ltl,                      // $17
      order.twic,                     // $18
      order.team_load,                // $19
      order.has_details,              // $20
      order.hazmat,                   // $21
      order.ramps_required,           // $22
      order.tarp_height,              // $23
      order.feet_remaining,           // $24
      order.top_100_customer,         // $25
      order.comments,                 // $26
      order.agent_phone,              // $27
      order.stopoffs,                 // $28
      order.pickup_date_early_utc,    // $29
      order.pickup_date_late_utc,     // $30
      order.delivery_date_early_utc,  // $31
      order.delivery_date_late_utc,   // $32
      order.pickup_date_early_local,  // $33
      order.pickup_date_late_local,   // $34
      order.delivery_date_early_local, // $35
      order.delivery_date_late_local, // $36
      order.order_status,             // $37
      order.first_seen,               // $38
      order.last_seen,                // $39
    ],
  );
}
```

- [ ] **Step 3: Build to verify TypeScript compiles**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend/lambdas/dynamo-to-pg-orders-stream
npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add lambdas/dynamo-to-pg-orders-stream/src/field-mapper.ts lambdas/dynamo-to-pg-orders-stream/src/handler.ts
git commit -m "feat: stream lambda maps renamed and new _local/_utc date fields to postgres"
```

---

## Task 7: Update Route Search API

**Repo:** `haulvisor-backend`

**Files:**
- Modify: `api/src/routes/route-search.sql.ts`
- Modify: `api/src/routes/route-search.engine.ts`
- Modify: `api/src/routes/route-search.service.ts`
- Modify: `api/src/orders/orders.service.ts`

- [ ] **Step 1: Update `route-search.sql.ts`**

Replace the four references to old date field names:

```typescript
// In conditions array, replace:
//   `pickup_date_early IS NOT NULL`,
//   `pickup_date_late IS NOT NULL`,
//   `delivery_date_early IS NOT NULL`,
//   `delivery_date_late IS NOT NULL`,
// With:
    `pickup_date_early_utc IS NOT NULL`,
    `pickup_date_late_utc IS NOT NULL`,
    `delivery_date_early_utc IS NOT NULL`,
    `delivery_date_late_utc IS NOT NULL`,

// In the reachability condition, replace:
//   `pickup_date_late >= to_timestamp($5::bigint / 1000.0) + ...`
// With:
    `pickup_date_late_utc >= to_timestamp($5::bigint / 1000.0) + (ST_Distance(origin_point, ST_MakePoint($2, $1)::geography) / ${METERS_PER_MILE} / $6) * interval '1 hour'`,

// In the SELECT clause, replace:
//   pickup_date_early, pickup_date_late, delivery_date_early, delivery_date_late,
// With:
  pickup_date_early_utc, pickup_date_late_utc, delivery_date_early_utc, delivery_date_late_utc,
  pickup_date_early_local, pickup_date_late_local, delivery_date_early_local, delivery_date_late_local,
```

- [ ] **Step 2: Update `route-search.engine.ts`**

Find the `OrderRow` interface (around line 36) and update the date fields:

```typescript
// Replace the four old fields:
//   pickup_date_early: string | null;
//   pickup_date_late: string | null;
//   delivery_date_early: string | null;
//   delivery_date_late: string | null;
// With:
  pickup_date_early_utc: string | null;
  pickup_date_late_utc: string | null;
  delivery_date_early_utc: string | null;
  delivery_date_late_utc: string | null;
  pickup_date_early_local: string | null;
  pickup_date_late_local: string | null;
  delivery_date_early_local: string | null;
  delivery_date_late_local: string | null;
```

Find where the leg is built from an order row (around line 262) and update:

```typescript
// Replace:
//   pickup_date_early: order.pickup_date_early ?? undefined,
//   pickup_date_late: order.pickup_date_late ?? undefined,
//   delivery_date_early: order.delivery_date_early ?? undefined,
//   delivery_date_late: order.delivery_date_late ?? undefined,
// With:
      pickup_date_early_utc: order.pickup_date_early_utc ?? undefined,
      pickup_date_late_utc: order.pickup_date_late_utc ?? undefined,
      delivery_date_early_utc: order.delivery_date_early_utc ?? undefined,
      delivery_date_late_utc: order.delivery_date_late_utc ?? undefined,
      pickup_date_early_local: order.pickup_date_early_local ?? undefined,
      pickup_date_late_local: order.pickup_date_late_local ?? undefined,
      delivery_date_early_local: order.delivery_date_early_local ?? undefined,
      delivery_date_late_local: order.delivery_date_late_local ?? undefined,
```

Also find where a leg is built from stopoff `from`/`to` objects (around line 283) and update:

```typescript
// Replace:
//   pickup_date_early: from.early_date,
//   pickup_date_late: from.late_date,
//   delivery_date_early: to.early_date,
//   delivery_date_late: to.late_date,
// With:
      pickup_date_early_local: from.early_date_local,
      pickup_date_late_local: from.late_date_local,
      pickup_date_early_utc: from.early_date_utc ?? undefined,
      pickup_date_late_utc: from.late_date_utc ?? undefined,
      delivery_date_early_local: to.early_date_local,
      delivery_date_late_local: to.late_date_local,
      delivery_date_early_utc: to.early_date_utc ?? undefined,
      delivery_date_late_utc: to.late_date_utc ?? undefined,
```

- [ ] **Step 3: Update `route-search.service.ts`**

Find the leg-building section (around line 272) and update four fields to eight:

```typescript
// Replace:
//   pickup_date_early: row.pickup_date_early ?? undefined,
//   pickup_date_late: row.pickup_date_late ?? undefined,
//   delivery_date_early: row.delivery_date_early ?? undefined,
//   delivery_date_late: row.delivery_date_late ?? undefined,
// With:
      pickup_date_early_utc: row.pickup_date_early_utc ?? undefined,
      pickup_date_late_utc: row.pickup_date_late_utc ?? undefined,
      delivery_date_early_utc: row.delivery_date_early_utc ?? undefined,
      delivery_date_late_utc: row.delivery_date_late_utc ?? undefined,
      pickup_date_early_local: row.pickup_date_early_local ?? undefined,
      pickup_date_late_local: row.pickup_date_late_local ?? undefined,
      delivery_date_early_local: row.delivery_date_early_local ?? undefined,
      delivery_date_late_local: row.delivery_date_late_local ?? undefined,
```

- [ ] **Step 4: Update `orders.service.ts` — add new fields to the allowlist**

In the `ORDER_FIELDS` Set, replace the four old field names with eight new ones:

```typescript
// Remove:
//   'pickup_date_early',
//   'pickup_date_late',
//   'delivery_date_early',
//   'delivery_date_late',
// Add:
  'pickup_date_early_utc',
  'pickup_date_late_utc',
  'delivery_date_early_utc',
  'delivery_date_late_utc',
  'pickup_date_early_local',
  'pickup_date_late_local',
  'delivery_date_early_local',
  'delivery_date_late_local',
```

Also update the `ProjectionExpression` string in the orders list query (around line 186):

```typescript
// Replace:
//   'company_id, order_id, origin_city, origin_state, origin_lat, origin_lng, destination_city, destination_state, destination_lat, destination_lng, pay, miles, rate_per_mile, trailer_type, pickup_date_early, pickup_date_late, weight'
// With:
  'company_id, order_id, origin_city, origin_state, origin_lat, origin_lng, destination_city, destination_state, destination_lat, destination_lng, pay, miles, rate_per_mile, trailer_type, pickup_date_early_local, pickup_date_late_local, pickup_date_early_utc, pickup_date_late_utc, weight'
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend/api
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in route-search files.

- [ ] **Step 6: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add api/src/routes/route-search.sql.ts api/src/routes/route-search.engine.ts api/src/routes/route-search.service.ts api/src/orders/orders.service.ts
git commit -m "feat: route search and orders API use renamed _utc/_local date fields"
```

---

## Task 8: Update Geocoding Worker — Add Timezone Resolution

**Repo:** `haulvisor-backend`

**Files:**
- Modify: `lambdas/geocoding-worker/package.json`
- Modify: `lambdas/geocoding-worker/src/handler.ts`
- Modify: `lambdas/geocoding-worker/src/handler.spec.ts`

- [ ] **Step 1: Add dependencies**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend/lambdas/geocoding-worker
npm install geo-tz luxon
npm install --save-dev @types/luxon
```

- [ ] **Step 2: Write the failing test addition**

Add to `handler.spec.ts` — add a new test case that verifies timezone and UTC date fields are written. First read the current test structure to know where to insert. Add after the existing tests:

```typescript
// At top of file, ensure these mocks exist or add:
// jest.mock('geo-tz', () => ({ find: jest.fn().mockReturnValue(['America/Chicago']) }));

it('resolves timezone per stopoff and writes _utc date fields', async () => {
  // Mock order with stopoffs but no timezone yet
  mockDynamoGet.mockResolvedValueOnce({
    Item: {
      company_id: 'test-company',
      order_id: 'E999',
      origin_city: 'Houston',
      origin_state: 'TX',
      destination_city: 'Chicago',
      destination_state: 'IL',
      origin_lat: null,
      destination_lat: null,
      stopoffs: [
        {
          sequence: 0, type: 'pickup', city: 'HOUSTON', state: 'TX',
          early_date_local: '2026-04-01T08:00:00',
          late_date_local: '2026-04-01T13:00:00',
          early_date_utc: null, late_date_utc: null, iana_timezone: null,
        },
        {
          sequence: 1, type: 'dropoff', city: 'CHICAGO', state: 'IL',
          early_date_local: '2026-04-02T09:00:00',
          late_date_local: '2026-04-02T17:00:00',
          early_date_utc: null, late_date_utc: null, iana_timezone: null,
        },
      ],
    },
  });

  // The update call should write stopoffs with iana_timezone + _utc fields
  // and flat _utc fields derived from first pickup / last dropoff
  await handler(mockSqsEvent);

  const updateCall = mockDynamoUpdate.mock.calls[0][0];
  const updatedStopoffs = updateCall.ExpressionAttributeValues[':stopoffs'];
  expect(updatedStopoffs[0].iana_timezone).toBe('America/Chicago');
  expect(updatedStopoffs[0].early_date_utc).toBe('2026-04-01T13:00:00.000Z'); // 8am CT = 1pm UTC
  expect(updatedStopoffs[0].late_date_utc).toBe('2026-04-01T18:00:00.000Z'); // 1pm CT = 6pm UTC

  // flat _utc fields come from first pickup
  expect(updateCall.ExpressionAttributeValues[':pickup_early_utc']).toBe('2026-04-01T13:00:00.000Z');
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend/lambdas/geocoding-worker
npm test 2>&1 | tail -20
```

- [ ] **Step 4: Update `handler.ts` to add timezone resolution**

Replace the full `handler.ts`:

```typescript
import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { find as geoFind } from 'geo-tz';
import { DateTime } from 'luxon';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const ORDERS_TABLE = process.env.ORDERS_TABLE || 'haulvisor-orders';
const CACHE_TABLE = process.env.GEOCODE_CACHE_TABLE || 'haulvisor-geocode-cache';
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

interface GeoResult {
  lat: number;
  lng: number;
}

interface GeocodingMessage {
  companyId: string;
  orderIds: string[];
}

interface Stopoff {
  sequence: number;
  type: string;
  city: string;
  state: string;
  early_date_local?: string;
  late_date_local?: string;
  early_date_utc: string | null;
  late_date_utc: string | null;
  iana_timezone: string | null;
  [key: string]: unknown;
}

async function geocode(location: string): Promise<GeoResult | null> {
  const cacheKey = location.toLowerCase().trim();

  const cached = await docClient.send(
    new GetCommand({ TableName: CACHE_TABLE, Key: { location_key: cacheKey } }),
  );
  if (cached.Item?.lat != null && cached.Item?.lng != null) {
    return { lat: cached.Item.lat as number, lng: cached.Item.lng as number };
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${MAPBOX_TOKEN}&country=US&types=place&limit=1`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`Mapbox geocoding failed for "${location}": ${res.status}`);
    return null;
  }

  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature?.center) {
    console.warn(`No geocoding result for "${location}"`);
    return null;
  }

  const result: GeoResult = { lat: feature.center[1], lng: feature.center[0] };

  const ttl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  await docClient.send(
    new PutCommand({
      TableName: CACHE_TABLE,
      Item: { location_key: cacheKey, lat: result.lat, lng: result.lng, ttl },
    }),
  );

  return result;
}

/** Convert a naive local date string + IANA timezone to a UTC ISO string */
function localToUtc(localStr: string, ianaTimezone: string): string {
  return DateTime.fromISO(localStr, { zone: ianaTimezone }).toUTC().toISO()!;
}

/** Resolve timezone for a stopoff's city/state and convert its local dates to UTC */
async function resolveStopoffTimezone(stopoff: Stopoff): Promise<Stopoff> {
  if (stopoff.iana_timezone != null) return stopoff; // already resolved

  const location = `${stopoff.city}, ${stopoff.state}`;
  const coords = await geocode(location);
  if (!coords) {
    console.warn(`Could not geocode stopoff location "${location}" — timezone skipped`);
    return stopoff;
  }

  const timezones = geoFind(coords.lat, coords.lng);
  if (!timezones.length) {
    console.warn(`geo-tz returned no timezone for ${coords.lat},${coords.lng} (${location})`);
    return stopoff;
  }

  const iana_timezone = timezones[0];
  return {
    ...stopoff,
    iana_timezone,
    early_date_utc: stopoff.early_date_local ? localToUtc(stopoff.early_date_local, iana_timezone) : null,
    late_date_utc: stopoff.late_date_local ? localToUtc(stopoff.late_date_local, iana_timezone) : null,
  };
}

async function geocodeOrder(companyId: string, orderId: string): Promise<boolean> {
  const order = await docClient.send(
    new GetCommand({
      TableName: ORDERS_TABLE,
      Key: { company_id: companyId, order_id: orderId },
    }),
  );

  if (!order.Item) {
    console.warn(`Order not found: ${companyId}/${orderId}`);
    return false;
  }

  const parts: string[] = [];
  const values: Record<string, unknown> = {};

  // Resolve origin lat/lng
  if (order.Item.origin_lat == null && order.Item.origin_city && order.Item.origin_state) {
    const r = await geocode(`${order.Item.origin_city}, ${order.Item.origin_state}`);
    if (r) {
      parts.push('origin_lat = :olat, origin_lng = :olng');
      values[':olat'] = r.lat;
      values[':olng'] = r.lng;
    }
  }

  // Resolve destination lat/lng
  if (order.Item.destination_lat == null && order.Item.destination_city && order.Item.destination_state) {
    const r = await geocode(`${order.Item.destination_city}, ${order.Item.destination_state}`);
    if (r) {
      parts.push('destination_lat = :dlat, destination_lng = :dlng');
      values[':dlat'] = r.lat;
      values[':dlng'] = r.lng;
    }
  }

  // Resolve timezone per stopoff
  const rawStopoffs = order.Item.stopoffs as Stopoff[] | undefined;
  const needsTimezone = rawStopoffs?.some(s => s.iana_timezone == null);

  if (rawStopoffs && needsTimezone) {
    const resolvedStopoffs = await Promise.all(rawStopoffs.map(resolveStopoffTimezone));

    // Derive flat _utc fields from first pickup and last dropoff
    const firstPickup = resolvedStopoffs.find(s => s.type === 'pickup');
    const lastDropoff = [...resolvedStopoffs].reverse().find(s => s.type === 'dropoff');

    parts.push('stopoffs = :stopoffs');
    values[':stopoffs'] = resolvedStopoffs;

    if (firstPickup) {
      parts.push('pickup_date_early_utc = :pickup_early_utc, pickup_date_late_utc = :pickup_late_utc');
      values[':pickup_early_utc'] = firstPickup.early_date_utc;
      values[':pickup_late_utc'] = firstPickup.late_date_utc;
    }
    if (lastDropoff) {
      parts.push('delivery_date_early_utc = :delivery_early_utc, delivery_date_late_utc = :delivery_late_utc');
      values[':delivery_early_utc'] = lastDropoff.early_date_utc;
      values[':delivery_late_utc'] = lastDropoff.late_date_utc;
    }
  }

  if (parts.length > 0) {
    await docClient.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { company_id: companyId, order_id: orderId },
        UpdateExpression: `SET ${parts.join(', ')}`,
        ExpressionAttributeValues: values,
      }),
    );
    return true;
  }

  return false;
}

export const handler = async (event: SQSEvent): Promise<void> => {
  if (!MAPBOX_TOKEN) {
    console.error('MAPBOX_ACCESS_TOKEN not set — skipping');
    return;
  }

  for (const record of event.Records) {
    const message: GeocodingMessage = JSON.parse(record.body);
    const { companyId, orderIds } = message;

    console.log(`Processing ${orderIds.length} orders for company ${companyId}`);

    let geocoded = 0;
    for (const orderId of orderIds) {
      try {
        const updated = await geocodeOrder(companyId, orderId);
        if (updated) geocoded++;
      } catch (err) {
        console.error(`Failed to geocode order ${orderId}:`, err);
      }
    }

    console.log(`Geocoded ${geocoded}/${orderIds.length} orders for company ${companyId}`);
  }
};
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend/lambdas/geocoding-worker
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Build lambda**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add lambdas/geocoding-worker/package.json lambdas/geocoding-worker/package-lock.json lambdas/geocoding-worker/src/handler.ts lambdas/geocoding-worker/src/handler.spec.ts
git commit -m "feat: geocoding worker resolves IANA timezone per stopoff, writes _utc date fields"
```

---

## Task 9: Backfill Script

**Repo:** `haulvisor-backend`

**Files:**
- Create: `scripts/backfill-stopoff-timezones.ts`

- [ ] **Step 1: Install geo-tz and luxon at the root for script use**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
npm install geo-tz luxon
npm install --save-dev @types/luxon
```

- [ ] **Step 2: Create the backfill script**

Create `scripts/backfill-stopoff-timezones.ts`:

```typescript
/**
 * Backfill IANA timezone and _utc date fields for open Mercer orders that
 * already have geocoded coordinates but are missing pickup_date_early_utc.
 *
 * Writes to DynamoDB only — the dynamo-to-pg stream lambda will sync
 * the _utc fields to PostgreSQL automatically.
 *
 * Usage:
 *   npx tsx scripts/backfill-stopoff-timezones.ts [--dry-run]
 *
 * Env vars: ORDERS_TABLE, GEOCODE_CACHE_TABLE, AWS_REGION
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { find as geoFind } from 'geo-tz';
import { DateTime } from 'luxon';

const ORDERS_TABLE = process.env.ORDERS_TABLE ?? 'haulvisor-orders';
const CACHE_TABLE = process.env.GEOCODE_CACHE_TABLE ?? 'haulvisor-geocode-cache';
const MERCER_COMPANY_ID = 'b08807e8-d0c2-4784-be44-fd27b75b5d07';
const DRY_RUN = process.argv.includes('--dry-run');

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

interface Stopoff {
  sequence: number;
  type: string;
  city: string;
  state: string;
  early_date_local?: string;
  late_date_local?: string;
  early_date_utc: string | null;
  late_date_utc: string | null;
  iana_timezone: string | null;
  [key: string]: unknown;
}

async function getCachedCoords(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  const key = `${city}, ${state}`.toLowerCase().trim();
  const result = await docClient.send(
    new GetCommand({ TableName: CACHE_TABLE, Key: { location_key: key } }),
  );
  if (result.Item?.lat != null && result.Item?.lng != null) {
    return { lat: result.Item.lat as number, lng: result.Item.lng as number };
  }
  return null;
}

function localToUtc(localStr: string, ianaTimezone: string): string {
  return DateTime.fromISO(localStr, { zone: ianaTimezone }).toUTC().toISO()!;
}

async function resolveStopoff(stopoff: Stopoff): Promise<Stopoff> {
  if (stopoff.iana_timezone != null) return stopoff;

  const coords = await getCachedCoords(stopoff.city, stopoff.state);
  if (!coords) {
    console.warn(`  No cached coords for "${stopoff.city}, ${stopoff.state}" — skipping`);
    return stopoff;
  }

  const timezones = geoFind(coords.lat, coords.lng);
  if (!timezones.length) {
    console.warn(`  geo-tz no result for ${coords.lat},${coords.lng} — skipping`);
    return stopoff;
  }

  const iana_timezone = timezones[0];
  return {
    ...stopoff,
    iana_timezone,
    early_date_utc: stopoff.early_date_local ? localToUtc(stopoff.early_date_local, iana_timezone) : null,
    late_date_utc: stopoff.late_date_local ? localToUtc(stopoff.late_date_local, iana_timezone) : null,
  };
}

async function backfill() {
  let lastKey: Record<string, unknown> | undefined;
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`Starting backfill${DRY_RUN ? ' [DRY RUN]' : ''}...`);
  console.log(`Company: ${MERCER_COMPANY_ID}`);

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: ORDERS_TABLE,
        KeyConditionExpression: 'company_id = :cid',
        FilterExpression:
          'order_status = :open AND attribute_exists(origin_lat) AND attribute_not_exists(pickup_date_early_utc)',
        ExpressionAttributeValues: {
          ':cid': MERCER_COMPANY_ID,
          ':open': 'open',
        },
        ExclusiveStartKey: lastKey,
      }),
    );

    for (const item of result.Items ?? []) {
      processed++;
      const stopoffs = item.stopoffs as Stopoff[] | undefined;

      if (!stopoffs || stopoffs.length === 0) {
        skipped++;
        continue;
      }

      const resolvedStopoffs = await Promise.all(stopoffs.map(resolveStopoff));
      const firstPickup = resolvedStopoffs.find(s => s.type === 'pickup');
      const lastDropoff = [...resolvedStopoffs].reverse().find(s => s.type === 'dropoff');

      if (!firstPickup?.early_date_utc) {
        console.warn(`  ${item.order_id}: could not resolve first pickup UTC — skipping`);
        skipped++;
        continue;
      }

      console.log(
        `  ${item.order_id}: ${firstPickup.iana_timezone} | ` +
        `pickup early ${firstPickup.early_date_local} → ${firstPickup.early_date_utc}`
      );

      if (!DRY_RUN) {
        await docClient.send(
          new UpdateCommand({
            TableName: ORDERS_TABLE,
            Key: { company_id: MERCER_COMPANY_ID, order_id: item.order_id },
            UpdateExpression:
              'SET stopoffs = :stopoffs, ' +
              'pickup_date_early_utc = :peu, pickup_date_late_utc = :plu, ' +
              'delivery_date_early_utc = :deu, delivery_date_late_utc = :dlu',
            ExpressionAttributeValues: {
              ':stopoffs': resolvedStopoffs,
              ':peu': firstPickup.early_date_utc,
              ':plu': firstPickup.late_date_utc,
              ':deu': lastDropoff?.early_date_utc ?? null,
              ':dlu': lastDropoff?.late_date_utc ?? null,
            },
          }),
        );
        updated++;
      } else {
        updated++; // count as would-update in dry run
      }
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`\nDone. Processed: ${processed}, Updated: ${updated}, Skipped: ${skipped}${DRY_RUN ? ' [DRY RUN — no writes made]' : ''}`);
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Dry run against production**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend/api
npx tsx ../scripts/backfill-stopoff-timezones.ts --dry-run 2>&1 | head -50
```

Expected: logs each order ID, timezone, and local→UTC conversion. No writes made.

- [ ] **Step 4: Run the real backfill**

```bash
npx tsx ../scripts/backfill-stopoff-timezones.ts 2>&1 | tee /tmp/backfill-timezone.log
```

Expected: "Done. Processed: ~8293, Updated: ~8293, Skipped: ~0"

- [ ] **Step 5: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add scripts/backfill-stopoff-timezones.ts package.json package-lock.json
git commit -m "feat: backfill IANA timezone and _utc date fields for open Mercer orders"
```

---

## Task 10: Frontend — Use Local Date Fields + Render All Stopoffs

**Repo:** `haulvisor`

**Files:**
- Modify: `src/features/orders/components/orders-table.tsx`
- Modify: `src/features/orders/components/order-summary-card.tsx`
- Modify: `src/features/routes/views/desktop/location-sidebar.tsx`
- Modify: `src/features/routes/views/desktop/route-detail-panel.tsx`
- Modify: `src/features/routes/views/mobile/screens/detail-screen.tsx`

- [ ] **Step 1: Update `orders-table.tsx`**

Find all references to `order.pickup_date_early` and `order.pickup_date_late` and replace with `order.pickup_date_early_local` and `order.pickup_date_late_local`. The `formatPickupDate` helper receives strings — no other changes needed.

- [ ] **Step 2: Update `order-summary-card.tsx`**

Replace `order.pickup_date_early` → `order.pickup_date_early_local` and `order.pickup_date_late` → `order.pickup_date_late_local` in all three references.

- [ ] **Step 3: Update `location-sidebar.tsx`**

Replace all four old field names with `_local` variants:
- `l.pickup_date_early` → `l.pickup_date_early_local`
- `l.delivery_date_late` → `l.delivery_date_late_local`
- `l.delivery_date_early` → `l.delivery_date_early_local`
- `l.pickup_date_late` → `l.pickup_date_late_local`

- [ ] **Step 4: Update `route-detail-panel.tsx` — use `_local` fields + render all stopoffs**

Replace date field references with `_local` variants.

For the leg detail section that currently shows pickup and delivery dates from flat fields, replace it with a stopoffs list. Find the section rendering `leg.pickup_date_early` (around line 313) and replace with:

```tsx
{leg.stopoffs && leg.stopoffs.length > 0 && (
  <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2 text-sm text-muted-foreground">
    {leg.stopoffs.map((stop, i) => (
      <div key={i}>
        <span className="capitalize font-medium text-foreground">{stop.type}</span>
        {' — '}
        {stop.company_name && <span>{stop.company_name}, </span>}
        {stop.city}, {stop.state}
        {stop.early_date_local && (
          <span className="ml-1">
            {formatDateRange(stop.early_date_local, stop.late_date_local)}
          </span>
        )}
      </div>
    ))}
  </div>
)}
{!leg.stopoffs && (leg.pickup_date_early_local || leg.delivery_date_early_local) && (
  <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5 text-sm text-muted-foreground">
    {leg.pickup_date_early_local && (
      <p>Pickup: {formatDateRange(leg.pickup_date_early_local, leg.pickup_date_late_local)}</p>
    )}
    {leg.delivery_date_early_local && (
      <p>Delivery: {formatDateRange(leg.delivery_date_early_local, leg.delivery_date_late_local)}</p>
    )}
  </div>
)}
```

- [ ] **Step 5: Update `detail-screen.tsx` (mobile) — use `_local` fields + render all stopoffs**

Replace the date section that uses flat fields with a stopoffs renderer (same pattern as above but using `formatDateTime`):

```tsx
{leg.stopoffs && leg.stopoffs.length > 0 && (
  <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
    {leg.stopoffs.map((stop, i) => (
      <div key={i} className="text-sm text-muted-foreground">
        <span className="capitalize font-medium text-foreground">{stop.type}</span>
        {' — '}
        {stop.city}, {stop.state}
        {stop.early_date_local && (
          <div className="ml-0 mt-0.5">
            <span>{formatDateTime(stop.early_date_local)}</span>
            {stop.late_date_local && stop.late_date_local !== stop.early_date_local && (
              <span> – {formatDateTime(stop.late_date_local)}</span>
            )}
          </div>
        )}
      </div>
    ))}
  </div>
)}
{!leg.stopoffs && (leg.pickup_date_early_local || leg.delivery_date_early_local) && (
  <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-1.5">
    {leg.pickup_date_early_local && (
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Pickup Early</span>
        <span>{formatDateTime(leg.pickup_date_early_local)}</span>
      </div>
    )}
    {leg.pickup_date_late_local && leg.pickup_date_late_local !== leg.pickup_date_early_local && (
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Pickup Late</span>
        <span>{formatDateTime(leg.pickup_date_late_local)}</span>
      </div>
    )}
    {leg.delivery_date_early_local && (
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Delivery Early</span>
        <span>{formatDateTime(leg.delivery_date_early_local)}</span>
      </div>
    )}
    {leg.delivery_date_late_local && leg.delivery_date_late_local !== leg.delivery_date_early_local && (
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Delivery Late</span>
        <span>{formatDateTime(leg.delivery_date_late_local)}</span>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor
git add src/features/orders/components/orders-table.tsx \
        src/features/orders/components/order-summary-card.tsx \
        src/features/routes/views/desktop/location-sidebar.tsx \
        src/features/routes/views/desktop/route-detail-panel.tsx \
        src/features/routes/views/mobile/screens/detail-screen.tsx
git commit -m "feat: display local pickup/delivery times, render all stopoffs in route detail"
```

---

## Deployment Checklist

After all tasks are complete and committed:

- [ ] Deploy `haulvisor-mercer` lambdas (order-details-scraper, stale-order-refresh)
- [ ] Deploy `haulvisor-backend` lambdas (geocoding-worker, dynamo-to-pg-orders-stream)
- [ ] Deploy `haulvisor-backend` API (NestJS)
- [ ] Run PostgreSQL migration against production (Task 5 Step 3)
- [ ] Run backfill script against production (Task 9 Step 4)
- [ ] Deploy `haulvisor` frontend
