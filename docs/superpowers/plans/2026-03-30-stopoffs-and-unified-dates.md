# Stopoffs & Unified ISO Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entire stack stopoff-aware — store an ordered stopoffs array as the source of truth for all date/location data, convert all dates to ISO 8601 at ingestion, and make route building + trip simulation consume the full stopoffs sequence instead of flat pickup/delivery date fields.

**Architecture:** The available-orders scraper stops writing pickup dates (they're unreliable MM/DD/YYYY from the board). The order-details scraper becomes the sole source of date truth, converting all dates to ISO and storing a properly ordered stopoffs array. The flat `pickup_date_early/late` and `delivery_date_early/late` fields become derived convenience fields (first pickup early, last delivery late) for backward compatibility, but route building and trip simulation read the full stopoffs array from Postgres JSONB. The `TripLeg` concept changes: one order with 3 stopoffs produces 2 driving segments (pickup→pickup, pickup→dropoff), each with their own time windows.

**Tech Stack:** TypeScript, DynamoDB, Postgres (PostGIS + JSONB), Jest, NestJS, haulvisor-core shared package

**Repos involved:**
- `haulvisor-core` — shared types and trip simulator
- `haulvisor-mercer` — available-orders scraper + order-details scraper
- `haulvisor-backend` — API, route builder, DynamoDB-to-PG stream
- `haulvisor` — frontend (minimal changes, stopoffs-table already renders correctly)

---

## Task 1: Update Stopoff type in haulvisor-core

**Files:**
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-core/src/types/order.ts`

The `Stopoff` type needs a constrained `type` field and dates documented as ISO 8601.

- [ ] **Step 1: Update the Stopoff interface**

```typescript
export interface Stopoff {
  /** Execution order (0-based). Stopoffs MUST be stored sorted by this field. */
  sequence: number;
  /** Stop type — constrained to known values from Mercer */
  type: 'pickup' | 'dropoff';
  company_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  zip: string;
  /** Earliest arrival time (ISO 8601 UTC) */
  early_date: string;
  /** Latest arrival time (ISO 8601 UTC) */
  late_date: string;
  contact_phone?: string;
}
```

- [ ] **Step 2: Build haulvisor-core**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-core && npm run build`
Expected: Clean build, no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-core
git add src/types/order.ts
git commit -m "feat: add sequence and constrain type on Stopoff interface"
```

---

## Task 2: Fix parseMercerDate timezone and update toNormalizedOrder

**Files:**
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper/src/index.ts`
- Create: `/Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper/src/__tests__/normalize.test.ts`

- [ ] **Step 1: Write tests for parseMercerDate and toNormalizedOrder**

Create `/Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper/src/__tests__/normalize.test.ts`:

```typescript
import { parseMercerDate, toNormalizedOrder } from '../normalize';
import type { OrderDetails } from '../parser';

describe('parseMercerDate', () => {
  it('parses MM/DD/YYYY to ISO UTC', () => {
    expect(parseMercerDate('03/30/2026')).toBe('2026-03-30T00:00:00.000Z');
  });

  it('parses MM/DD/YYYY HH:mm to ISO UTC', () => {
    expect(parseMercerDate('03/30/2026 06:00')).toBe('2026-03-30T06:00:00.000Z');
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

  it('handles single pickup + single dropoff', () => {
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

    // Stopoffs are ordered with sequence numbers
    expect(result.stopoffs).toHaveLength(2);
    expect(result.stopoffs![0]).toMatchObject({
      sequence: 0, type: 'pickup', city: 'HOUSTON',
      early_date: '2026-03-30T06:00:00.000Z', late_date: '2026-03-30T13:00:00.000Z',
    });
    expect(result.stopoffs![1]).toMatchObject({
      sequence: 1, type: 'dropoff', city: 'JACKSON',
      early_date: '2026-04-01T08:00:00.000Z', late_date: '2026-04-02T14:00:00.000Z',
    });

    // Flat fields: first pickup early, last delivery late
    expect(result.pickup_date_early).toBe('2026-03-30T06:00:00.000Z');
    expect(result.pickup_date_late).toBe('2026-03-30T13:00:00.000Z');
    expect(result.delivery_date_early).toBe('2026-04-01T08:00:00.000Z');
    expect(result.delivery_date_late).toBe('2026-04-02T14:00:00.000Z');
  });

  it('handles multi-pickup + single dropoff (the Mercer multi-stop case)', () => {
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
          early_date: '04/01/2026 08:00', late_date: '04/02/2026 14:00', contact_phone: '',
        },
      ],
    };

    const result = toNormalizedOrder(details);

    // All 3 stopoffs preserved in order
    expect(result.stopoffs).toHaveLength(3);
    expect(result.stopoffs![0]).toMatchObject({ sequence: 0, type: 'pickup', city: 'HOUSTON' });
    expect(result.stopoffs![1]).toMatchObject({ sequence: 1, type: 'pickup', city: 'OKLAHOMA CITY' });
    expect(result.stopoffs![2]).toMatchObject({ sequence: 2, type: 'dropoff', city: 'JACKSON' });

    // Flat fields: first pickup early/late for pickup, last dropoff early/late for delivery
    expect(result.pickup_date_early).toBe('2026-03-30T06:00:00.000Z');
    expect(result.pickup_date_late).toBe('2026-03-30T13:00:00.000Z');
    expect(result.delivery_date_early).toBe('2026-04-01T08:00:00.000Z');
    expect(result.delivery_date_late).toBe('2026-04-02T14:00:00.000Z');
  });

  it('handles no stopoffs gracefully', () => {
    const result = toNormalizedOrder(baseDetails);
    expect(result.stopoffs).toBeUndefined();
    expect(result.pickup_date_early).toBeUndefined();
    expect(result.delivery_date_early).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper && npx jest src/__tests__/normalize.test.ts --no-cache`
Expected: FAIL — `normalize` module doesn't exist yet

- [ ] **Step 3: Extract parseMercerDate and toNormalizedOrder into a standalone module**

Create `/Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper/src/normalize.ts`:

```typescript
import type { OrderDetails, Stopoff as RawStopoff } from './parser.js';

const COMPANY_ID = process.env.COMPANY_ID || 'mercer-local-dev';

/**
 * Parse mercer date format (MM/DD/YYYY or MM/DD/YYYY HH:mm) to ISO 8601 UTC string.
 * Returns undefined if the input is empty or unparseable.
 */
export function parseMercerDate(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return undefined;
  const [, month, day, year, hours, minutes] = match;
  // Explicitly construct UTC — append Z so Date() treats it as UTC, not local
  const iso = `${year}-${month}-${day}T${hours ?? '00'}:${minutes ?? '00'}:00.000Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Normalize raw stopoff type string to constrained union */
function normalizeStopoffType(raw: string): 'pickup' | 'dropoff' {
  const lower = raw.toLowerCase();
  if (lower === 'pickup') return 'pickup';
  return 'dropoff'; // 'delivery', 'dropoff', 'drop', etc. all map to 'dropoff'
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

  // Build ordered stopoffs with sequence numbers and ISO dates
  const normalizedStopoffs = details.stopoffs.map((s, i) => ({
    sequence: i,
    type: normalizeStopoffType(s.type),
    company_name: s.company_name,
    address_1: s.address_1,
    address_2: s.address_2 || undefined,
    city: s.city,
    state: s.state,
    zip: s.zip,
    early_date: parseMercerDate(s.early_date) ?? s.early_date,
    late_date: parseMercerDate(s.late_date) ?? s.late_date,
    contact_phone: s.contact_phone || undefined,
  }));

  // Derive flat convenience fields from first pickup and last dropoff
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
    // Flat date fields for backward compatibility
    ...(firstPickup ? {
      pickup_date_early: firstPickup.early_date,
      pickup_date_late: firstPickup.late_date,
    } : {}),
    ...(lastDropoff ? {
      delivery_date_early: lastDropoff.early_date,
      delivery_date_late: lastDropoff.late_date,
    } : {}),
  };
}
```

- [ ] **Step 4: Update index.ts to import from normalize module**

In `/Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper/src/index.ts`:

Remove the `parseMercerDate` function (lines 27-37) and the `toNormalizedOrder` function (lines 40-80). Replace with:

```typescript
import { toNormalizedOrder } from './normalize.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/order-details-scraper && npx jest src/__tests__/normalize.test.ts --no-cache`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer
git add lambdas/order-details-scraper/src/normalize.ts lambdas/order-details-scraper/src/__tests__/normalize.test.ts lambdas/order-details-scraper/src/index.ts
git commit -m "feat: extract normalize module, fix timezone bug, handle multi-stop orders"
```

---

## Task 3: Remove pickup dates from available-orders scraper

**Files:**
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/available-orders-scraper/src/parser.ts`
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/available-orders-scraper/src/db.ts`

- [ ] **Step 1: Remove pickup_date_early/late from ParsedOrder interface and parser**

In `parser.ts`, remove `pickup_date_early` and `pickup_date_late` from the `ParsedOrder` interface (lines 8-9).

Remove the `parseDateRange` helper from the browser-side `PARSE_SCRIPT` string (lines 46-52 inside the template) and the line that calls it (line 81).

Remove `pickup_date_early: pickupEarly` and `pickup_date_late: pickupLate` from the `orders.push()` call (lines 91-92).

Remove the exported `parseDateRange` function (lines 135-141) — it will no longer be needed.

- [ ] **Step 2: Remove pickup dates from DynamoDB writes in db.ts**

In `db.ts`, remove `pickup_date_early` and `pickup_date_late` from:
- The `PutRequest.Item` in `upsertOrders` new order batch write (lines 95-96)
- The `UpdateExpression` SET clause for existing orders (lines 133-134)
- The `ExpressionAttributeValues` map (lines 156-157)

- [ ] **Step 3: Run available-orders scraper tests**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer/lambdas/available-orders-scraper && npx jest --no-cache`
Expected: PASS (or no tests — check; if tests reference pickup dates, update them)

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-mercer
git add lambdas/available-orders-scraper/src/parser.ts lambdas/available-orders-scraper/src/db.ts
git commit -m "feat: remove pickup dates from available-orders scraper (detail scraper is source of truth)"
```

---

## Task 4: Remove pickup dates from backend required fields

**Files:**
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/api/src/orders/orders.service.ts`

- [ ] **Step 1: Remove pickup_date_early and pickup_date_late from REQUIRED_ORDER_FIELDS**

In `orders.service.ts` lines 44-61, remove `'pickup_date_early'` and `'pickup_date_late'` from the `REQUIRED_ORDER_FIELDS` array. Keep them in `ORDER_FIELDS` (they're still valid optional fields written by the detail scraper).

```typescript
const REQUIRED_ORDER_FIELDS = [
  'order_id',
  'origin_city',
  'origin_state',
  'destination_city',
  'destination_state',
  'pay',
  'miles',
  'rate_per_mile',
  'weight',
  'trailer_type',
  'ltl',
  'twic',
  'team_load',
] as const;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add api/src/orders/orders.service.ts
git commit -m "feat: make pickup dates optional (populated by detail scraper, not board scraper)"
```

---

## Task 5: Add stopoffs to Postgres OrderRow and route builder SQL

**Files:**
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/api/src/routes/routes.service.ts`
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/api/src/routes/round-trip.service.ts`

This is the critical change: make the route builder read the `stopoffs` JSONB column and use it to build multi-segment `TripLeg[]` arrays for the simulator.

- [ ] **Step 1: Add stopoffs to OrderRow interface in routes.service.ts**

In `routes.service.ts`, add to the `OrderRow` interface:

```typescript
  stopoffs: Array<{
    sequence: number;
    type: 'pickup' | 'dropoff';
    city: string;
    state: string;
    early_date: string;
    late_date: string;
  }> | null;
```

- [ ] **Step 2: Add stopoffs to SQL SELECT in buildCandidatesSql**

In the `buildCandidatesSql` function, add `stopoffs` to the SELECT list:

```sql
SELECT order_id, origin_city, origin_state, dest_city, dest_state,
  ST_Y(origin_point::geometry) AS origin_lat, ST_X(origin_point::geometry) AS origin_lng,
  ST_Y(dest_point::geometry) AS dest_lat, ST_X(dest_point::geometry) AS dest_lng,
  pay::real, miles::real, rate_per_mile::real, trailer_type, weight::real,
  pickup_date_early, pickup_date_late, delivery_date_early, delivery_date_late,
  stopoffs,
  ST_Distance(origin_point, ST_MakePoint($2, $1)::geography) / 1609.34 AS deadhead_miles
FROM orders
```

Note: `stopoffs` is JSONB in Postgres. The `pg` driver automatically parses JSONB columns into JS objects, so `row.stopoffs` will be the parsed array or null.

- [ ] **Step 3: Create buildTripLegsFromOrder helper function**

Add a new helper function in `routes.service.ts` (above the class) that builds `TripLeg[]` from an `OrderRow`, using the stopoffs array when available:

```typescript
/**
 * Build TripLeg[] for a single order. If the order has a stopoffs array with
 * multiple stops, each consecutive pair of stops becomes a driving segment
 * with its own time windows. Falls back to the flat date fields for orders
 * without detailed stopoffs.
 */
function buildTripLegsForOrder(order: OrderRow): TripLeg[] {
  const stopoffs = order.stopoffs;

  // If no stopoffs or single stop, use flat fields (backward compatible)
  if (!stopoffs || stopoffs.length < 2) {
    return [{
      kind: 'load' as const,
      miles: order.miles,
      weight_lbs: order.weight ?? 0,
      origin_city: order.origin_city,
      destination_city: order.dest_city,
      pickup_date_early: order.pickup_date_early ?? undefined,
      pickup_date_late: order.pickup_date_late ?? undefined,
      delivery_date_early: order.delivery_date_early ?? undefined,
      delivery_date_late: order.delivery_date_late ?? undefined,
    }];
  }

  // Multi-stop: each consecutive pair becomes a driving segment.
  // We don't have per-segment mileage, so distribute total miles proportionally
  // based on the number of segments. This is an approximation — a future
  // improvement could use driving distance between each stop pair.
  const segmentCount = stopoffs.length - 1;
  const milesPerSegment = order.miles / segmentCount;
  // Weight applies to the whole load — only relevant while loaded
  const weightPerSegment = order.weight ?? 0;

  const legs: TripLeg[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const from = stopoffs[i];
    const to = stopoffs[i + 1];

    legs.push({
      kind: 'load',
      miles: milesPerSegment,
      weight_lbs: weightPerSegment,
      origin_city: `${from.city}, ${from.state}`,
      destination_city: `${to.city}, ${to.state}`,
      // The "pickup" at this stop: the time window for the FROM stop
      pickup_date_early: from.early_date,
      pickup_date_late: from.late_date,
      // The "delivery" at this stop: the time window for the TO stop
      delivery_date_early: to.early_date,
      delivery_date_late: to.late_date,
    });
  }

  return legs;
}
```

- [ ] **Step 4: Update buildChain to use buildTripLegsForOrder**

In `buildChain()`, replace the `TripLeg[]` construction loop (lines 165-188 in routes.service.ts) with:

```typescript
    // Build TripLeg[] for the simulator — multi-stop orders expand to multiple segments
    const tripLegs: TripLeg[] = [];
    for (let i = 0; i < orders.length; i++) {
      if (deadheadPerLeg[i] > 0) {
        const prevCity = i === 0 ? '' : orders[i - 1].dest_city;
        tripLegs.push({
          kind: 'deadhead',
          miles: deadheadPerLeg[i],
          weight_lbs: 0,
          origin_city: prevCity,
          destination_city: orders[i].origin_city,
        });
      }
      tripLegs.push(...buildTripLegsForOrder(orders[i]));
    }
    if (routeEndDeadhead > 0) {
      tripLegs.push({
        kind: 'deadhead',
        miles: routeEndDeadhead,
        weight_lbs: 0,
        origin_city: orders[orders.length - 1].dest_city,
        destination_city: '',
      });
    }
```

- [ ] **Step 5: Update getTimingSlack to use last delivery from stopoffs**

In `getTimingSlack()`, the estimated delivery time should come from the last stopoff's late_date when available:

```typescript
  private getTimingSlack(
    prevOrder: OrderRow,
    nextOrder: OrderRow,
    transitionDistance: number,
    maxLayoverHours?: number,
    avgSpeedMph?: number,
    avgDrivingHoursPerDay?: number,
  ): { valid: boolean; waitHours: number } {
    if (!prevOrder.pickup_date_late || !nextOrder.pickup_date_late) {
      return { valid: true, waitHours: 0 };
    }

    const transitSettings = { avg_speed_mph: avgSpeedMph, avg_driving_hours_per_day: avgDrivingHoursPerDay };

    // Use first pickup early as trip start
    const pickupMs = new Date(prevOrder.pickup_date_early ?? prevOrder.pickup_date_late).getTime();
    const estimatedDriveMs = estimateTransitionHours(prevOrder.miles, transitSettings) * 3_600_000;
    const estimatedDeliveryMs = pickupMs + estimatedDriveMs;

    // Use last delivery window from stopoffs if available, fall back to flat field
    let deliveryWindowMs: number;
    const lastDeliveryStopoff = prevOrder.stopoffs
      ?.filter(s => s.type === 'dropoff')
      .pop();
    if (lastDeliveryStopoff) {
      deliveryWindowMs = new Date(lastDeliveryStopoff.early_date).getTime();
    } else if (prevOrder.delivery_date_early) {
      deliveryWindowMs = new Date(prevOrder.delivery_date_early).getTime();
    } else {
      deliveryWindowMs = estimatedDeliveryMs;
    }
    const prevDeliveryMs = Math.max(estimatedDeliveryMs, deliveryWindowMs);

    const transitionMs = estimateTransitionHours(transitionDistance, transitSettings) * 3_600_000;
    const estimatedArrival = prevDeliveryMs + transitionMs;

    const nextDeadline = new Date(nextOrder.pickup_date_late).getTime();
    const nextEarliest = nextOrder.pickup_date_early
      ? new Date(nextOrder.pickup_date_early).getTime()
      : 0;
    const effectiveArrival = Math.max(estimatedArrival, nextEarliest);

    const slackMs = nextDeadline - effectiveArrival;
    const waitMs = Math.max(0, nextEarliest - (prevDeliveryMs + transitionMs));
    const waitHours = waitMs / 3_600_000;

    if (maxLayoverHours != null && waitHours > maxLayoverHours) {
      return { valid: false, waitHours };
    }

    return { valid: slackMs >= 0, waitHours };
  }
```

- [ ] **Step 6: Apply the same changes to round-trip.service.ts**

The `OrderRow` interface, `buildTripLegsForOrder`, and `getTimingSlack` changes from steps 1-5 need to be replicated in `round-trip.service.ts`. The `OrderRow` interface is duplicated there (lines 14-37), and `getTimingSlack` is also duplicated (line 791+).

Add `stopoffs` to the `OrderRow` interface, add `stopoffs` to the SQL SELECT (line 89), and update the trip leg construction in the `buildChain` method and `getTimingSlack` to match routes.service.ts.

Consider extracting `buildTripLegsForOrder` to a shared file if it's identical — but since both files are in the same directory, a direct copy is acceptable for now.

- [ ] **Step 7: Verify backend compiles**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend && npm run build`
Expected: Clean build

- [ ] **Step 8: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add api/src/routes/routes.service.ts api/src/routes/round-trip.service.ts
git commit -m "feat: make route builder stopoff-aware, expand multi-stop orders into driving segments"
```

---

## Task 6: Update suggested-departure to use first stopoff

**Files:**
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/api/src/routes/suggested-departure.ts`

- [ ] **Step 1: Update computeSuggestedDeparture to accept stopoffs**

The function should prefer the first pickup stopoff's early_date over the flat `pickup_date_early`:

```typescript
/**
 * Compute optimal departure time: first pickup window minus deadhead transit time.
 * Prefers the first pickup stopoff's early_date when available.
 * Returns ISO datetime string, or undefined if no pickup date available.
 */
export function computeSuggestedDeparture(
  firstLeg: {
    pickup_date_early?: string | null;
    stopoffs?: Array<{ type: string; early_date: string }> | null;
  },
  deadheadMiles: number,
  avgSpeedMph: number = 55,
): string | undefined {
  // Prefer first pickup from stopoffs array
  const firstPickupStopoff = firstLeg.stopoffs?.find(s => s.type === 'pickup');
  const pickupEarly = firstPickupStopoff?.early_date ?? firstLeg.pickup_date_early;
  if (!pickupEarly) return undefined;
  const pickupMs = new Date(pickupEarly).getTime();
  const transitHours = deadheadMiles / avgSpeedMph;
  const departMs = pickupMs - transitHours * 3_600_000;
  return new Date(departMs).toISOString();
}
```

- [ ] **Step 2: Update the call site in routes.service.ts buildChain**

The existing call at line 265 passes `orders[0]` which is an `OrderRow` — now that `OrderRow` has `stopoffs`, the function will automatically use it. No change needed if the interface matches.

Verify: the `OrderRow` type in routes.service.ts has `stopoffs` (added in Task 5 Step 1), and the function parameter accepts it. This should work as-is.

- [ ] **Step 3: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add api/src/routes/suggested-departure.ts
git commit -m "feat: prefer stopoffs array for suggested departure calculation"
```

---

## Task 7: Backfill existing DynamoDB dates to ISO

**Files:**
- Create: `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/scripts/backfill-iso-dates.ts`

- [ ] **Step 1: Write the backfill script**

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const ORDERS_TABLE = process.env.ORDERS_TABLE ?? 'haulvisor-orders';
const DRY_RUN = process.argv.includes('--dry-run');

const MM_DD_YYYY_RE = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/;

function toIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.trim().match(MM_DD_YYYY_RE);
  if (!match) return undefined; // already ISO or unparseable
  const [, month, day, year, hours, minutes] = match;
  const iso = `${year}-${month}-${day}T${hours ?? '00'}:${minutes ?? '00'}:00.000Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

async function backfill() {
  let lastKey: Record<string, unknown> | undefined;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: ORDERS_TABLE,
        ProjectionExpression: 'company_id, order_id, pickup_date_early, pickup_date_late, delivery_date_early, delivery_date_late, stopoffs',
        ExclusiveStartKey: lastKey,
      }),
    );

    for (const item of result.Items ?? []) {
      scanned++;
      const updates: Record<string, string> = {};

      // Check flat date fields
      for (const field of ['pickup_date_early', 'pickup_date_late', 'delivery_date_early', 'delivery_date_late'] as const) {
        const val = item[field] as string | undefined;
        if (val && MM_DD_YYYY_RE.test(val.trim())) {
          const iso = toIso(val);
          if (iso) updates[field] = iso;
        }
      }

      // Check stopoff dates
      const stopoffs = item.stopoffs as Array<Record<string, unknown>> | undefined;
      let stopoffsNeedUpdate = false;
      if (stopoffs) {
        for (const s of stopoffs) {
          const earlyIso = toIso(s.early_date as string);
          const lateIso = toIso(s.late_date as string);
          if (earlyIso) { s.early_date = earlyIso; stopoffsNeedUpdate = true; }
          if (lateIso) { s.late_date = lateIso; stopoffsNeedUpdate = true; }
        }
      }

      if (Object.keys(updates).length === 0 && !stopoffsNeedUpdate) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would update ${item.company_id}/${item.order_id}:`, updates, stopoffsNeedUpdate ? '+ stopoff dates' : '');
        updated++;
        continue;
      }

      // Build update expression
      const exprParts: string[] = [];
      const exprValues: Record<string, unknown> = {};
      const exprNames: Record<string, string> = {};

      for (const [field, value] of Object.entries(updates)) {
        const placeholder = `:${field}`;
        const nameKey = `#${field}`;
        exprParts.push(`${nameKey} = ${placeholder}`);
        exprValues[placeholder] = value;
        exprNames[nameKey] = field;
      }

      if (stopoffsNeedUpdate && stopoffs) {
        exprParts.push('#stopoffs = :stopoffs');
        exprValues[':stopoffs'] = stopoffs;
        exprNames['#stopoffs'] = 'stopoffs';
      }

      await docClient.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE,
          Key: { company_id: item.company_id, order_id: item.order_id },
          UpdateExpression: `SET ${exprParts.join(', ')}`,
          ExpressionAttributeValues: exprValues,
          ExpressionAttributeNames: exprNames,
        }),
      );
      updated++;

      if (updated % 100 === 0) {
        console.log(`Progress: scanned=${scanned}, updated=${updated}, skipped=${skipped}`);
      }
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`\nDone. Scanned: ${scanned}, Updated: ${updated}, Skipped (already ISO): ${skipped}`);
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Test with dry run**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend && npx tsx scripts/backfill-iso-dates.ts --dry-run`
Expected: Prints orders that would be updated, no actual writes

- [ ] **Step 3: Run for real (after reviewing dry run output)**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend && npx tsx scripts/backfill-iso-dates.ts`
Expected: Updates all MM/DD/YYYY dates to ISO

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add scripts/backfill-iso-dates.ts
git commit -m "feat: add backfill script to convert MM/DD/YYYY dates to ISO in DynamoDB"
```

---

## Task 8: Backfill stopoff sequence numbers

**Files:**
- Create: `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/scripts/backfill-stopoff-sequences.ts`

Existing stopoffs in DynamoDB don't have `sequence` numbers. This script adds them based on array position (which is already correct — the Mercer detail scraper preserves DOM order).

- [ ] **Step 1: Write the backfill script**

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const ORDERS_TABLE = process.env.ORDERS_TABLE ?? 'haulvisor-orders';
const DRY_RUN = process.argv.includes('--dry-run');

function normalizeType(raw: string): 'pickup' | 'dropoff' {
  const lower = (raw || '').toLowerCase();
  return lower === 'pickup' ? 'pickup' : 'dropoff';
}

async function backfill() {
  let lastKey: Record<string, unknown> | undefined;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: ORDERS_TABLE,
        FilterExpression: 'attribute_exists(stopoffs)',
        ProjectionExpression: 'company_id, order_id, stopoffs',
        ExclusiveStartKey: lastKey,
      }),
    );

    for (const item of result.Items ?? []) {
      scanned++;
      const stopoffs = item.stopoffs as Array<Record<string, unknown>> | undefined;
      if (!stopoffs || stopoffs.length === 0) { skipped++; continue; }

      // Check if already has sequence numbers
      if (stopoffs[0].sequence != null) { skipped++; continue; }

      // Add sequence and normalize type
      const updated_stopoffs = stopoffs.map((s, i) => ({
        ...s,
        sequence: i,
        type: normalizeType(s.type as string),
      }));

      if (DRY_RUN) {
        console.log(`[DRY RUN] ${item.company_id}/${item.order_id}: ${stopoffs.length} stopoffs`);
        updated++;
        continue;
      }

      await docClient.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE,
          Key: { company_id: item.company_id, order_id: item.order_id },
          UpdateExpression: 'SET stopoffs = :stopoffs',
          ExpressionAttributeValues: { ':stopoffs': updated_stopoffs },
        }),
      );
      updated++;

      if (updated % 100 === 0) {
        console.log(`Progress: scanned=${scanned}, updated=${updated}, skipped=${skipped}`);
      }
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`\nDone. Scanned: ${scanned}, Updated: ${updated}, Skipped: ${skipped}`);
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry run**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend && npx tsx scripts/backfill-stopoff-sequences.ts --dry-run`

- [ ] **Step 3: Run for real**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend && npx tsx scripts/backfill-stopoff-sequences.ts`

- [ ] **Step 4: Commit**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add scripts/backfill-stopoff-sequences.ts
git commit -m "feat: add backfill script for stopoff sequence numbers and type normalization"
```

---

## Task 9: Verify end-to-end with a multi-stop order

- [ ] **Step 1: Verify the order from the screenshot in production DynamoDB**

Query one of the multi-stop orders and verify its stopoffs array has sequence numbers and ISO dates:

```bash
aws dynamodb get-item --table-name haulvisor-orders \
  --key '{"company_id":{"S":"b08807e8-d0c2-4784-be44-fd27b75b5d07"},"order_id":{"S":"<a known multi-stop order_id>"}}' \
  --projection-expression "stopoffs, pickup_date_early, delivery_date_late" \
  --output json
```

Expected: `stopoffs` has `sequence` numbers, `type` is lowercase, all dates are ISO.

- [ ] **Step 2: Run the backend locally and test route search**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend && npm run start:dev`

Hit the route search endpoint with a location near a multi-stop order's origin. Verify the response includes `timeline` phases that show loading/driving at each stopoff rather than a single pickup→delivery segment.

- [ ] **Step 3: Verify frontend renders correctly**

Load the app, search for routes, and expand a multi-stop order. The stopoffs table should show all stops. The timeline should show driving segments between each stop.

---

## Task 10: Show TARP chip on route legs with tarp_height > 0

**Files:**
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-core/src/types/routes.ts` (RouteLeg)
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-core/src/types/round-trip.ts` (RoundTripLeg)
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/api/src/routes/routes.service.ts` (SQL + rowToLeg)
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/api/src/routes/round-trip.service.ts` (SQL + rowToLeg)
- Modify: `/Users/matthewbennett/Documents/GitHub/haulvisor/src/features/routes/views/desktop/location-sidebar.tsx` (TARP chip)

The `tarp_height` field is already stored in DynamoDB and Postgres (`TEXT` column). When it's a non-zero value (e.g. `"4"`, `"6"`), the order requires a tarp. The route builder doesn't currently include this field — we need to thread it through to the frontend and show a chip.

- [ ] **Step 1: Add tarp_height to RouteLeg and RoundTripLeg types**

In `/Users/matthewbennett/Documents/GitHub/haulvisor-core/src/types/routes.ts`, add to the `RouteLeg` interface:

```typescript
  /** Tarp height in inches — present if order requires a tarp */
  tarp_height?: string;
```

In `/Users/matthewbennett/Documents/GitHub/haulvisor-core/src/types/round-trip.ts`, add to the `RoundTripLeg` interface:

```typescript
  /** Tarp height in inches — present if order requires a tarp */
  tarp_height?: string;
```

- [ ] **Step 2: Build haulvisor-core**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor-core && npm run build`
Expected: Clean build

- [ ] **Step 3: Add tarp_height to route builder SQL and OrderRow**

In `/Users/matthewbennett/Documents/GitHub/haulvisor-backend/api/src/routes/routes.service.ts`:

Add `tarp_height: string | null;` to the `OrderRow` interface.

Add `tarp_height` to the SQL SELECT in `buildCandidatesSql`:

```sql
  pay::real, miles::real, rate_per_mile::real, trailer_type, weight::real,
  tarp_height,
  pickup_date_early, pickup_date_late, delivery_date_early, delivery_date_late,
```

In `rowToLeg`, add:

```typescript
  tarp_height: row.tarp_height ?? undefined,
```

Apply the same changes to `round-trip.service.ts` — add `tarp_height` to `OrderRow`, SQL SELECT, and `rowToLeg`.

- [ ] **Step 4: Show TARP chip in route segment display**

In `/Users/matthewbennett/Documents/GitHub/haulvisor/src/features/routes/views/desktop/location-sidebar.tsx`, in the leg rendering section (around line 563, where the flame icon and comments button are), add a TARP badge after the lane_rank flame icon:

```tsx
{leg.lane_rank != null && <FlameIcon className="h-4 w-4 text-primary shrink-0" />}
{leg.tarp_height != null && parseInt(leg.tarp_height, 10) > 0 && (
  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 shrink-0 border-amber-500/50 text-amber-400">
    TARP {leg.tarp_height}&quot;
  </Badge>
)}
```

- [ ] **Step 4: Show "Tarp: Yes/No" in the RouteRow summary**

In `/Users/matthewbennett/Documents/GitHub/haulvisor/src/features/routes/views/desktop/route-row.tsx`, add a Tarp Yes/No indicator in the summary metrics row. Derive it from the chain's legs:

```tsx
const needsTarp = chain.legs.some(
  (l) => l.tarp_height != null && parseInt(l.tarp_height, 10) > 0,
);
```

Then add a fifth metric column in the `flex justify-around` row (after the Miles div, which is currently hidden):

```tsx
<div>
  <p className="text-sm uppercase tracking-wide text-text-secondary">Tarp</p>
  <p className={`text-lg font-bold ${needsTarp ? "text-amber-400" : "text-text-tertiary"}`}>
    {needsTarp ? "Yes" : "No"}
  </p>
</div>
```

- [ ] **Step 5: Build frontend to verify**

Run: `cd /Users/matthewbennett/Documents/GitHub/haulvisor && npm run build`
Expected: Clean build

- [ ] **Step 6: Commit all repos**

```bash
cd /Users/matthewbennett/Documents/GitHub/haulvisor-core
git add src/types/routes.ts src/types/round-trip.ts
git commit -m "feat: add tarp_height to RouteLeg and RoundTripLeg types"

cd /Users/matthewbennett/Documents/GitHub/haulvisor-backend
git add api/src/routes/routes.service.ts api/src/routes/round-trip.service.ts
git commit -m "feat: include tarp_height in route builder SQL and leg output"

cd /Users/matthewbennett/Documents/GitHub/haulvisor
git add src/features/routes/views/desktop/route-row.tsx
git commit -m "feat: show Tarp Yes/No in route summary row"
```

---

## Summary of changes by repo

**haulvisor-core:**
- `Stopoff` type gains `sequence: number` and `type` becomes `'pickup' | 'dropoff'`

**haulvisor-mercer:**
- Available-orders scraper: no longer writes pickup dates
- Order-details scraper: `toNormalizedOrder` extracted to `normalize.ts`, handles multi-stop correctly, all dates converted to ISO UTC

**haulvisor-backend:**
- `REQUIRED_ORDER_FIELDS` no longer includes pickup dates
- Route builder SQL includes `stopoffs` column
- `buildTripLegsForOrder()` expands multi-stop orders into per-segment `TripLeg[]`
- `getTimingSlack()` uses last delivery stopoff
- `computeSuggestedDeparture()` prefers stopoffs array
- Backfill scripts for ISO dates and stopoff sequence numbers

**haulvisor (frontend):**
- TARP chip on route legs when `tarp_height > 0` (amber badge showing height in inches)
- No other changes needed — `StopoffsTable` already renders all stops, and the timeline renders whatever phases the simulator produces.
