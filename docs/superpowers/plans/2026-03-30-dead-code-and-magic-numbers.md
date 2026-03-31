# Dead Code Removal & Magic Number Consolidation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead lane-confidence/speculative-leg code across all three repos and consolidate duplicated magic numbers into named constants in haulvisor-core.

**Architecture:** Core-first — add/consolidate constants in haulvisor-core, push to npm, then update backend and frontend to remove dead code and use the new constants.

**Tech Stack:** TypeScript, @mwbhtx/haulvisor-core, NestJS (backend), React (frontend)

---

## File Structure

### haulvisor-core (Phase 1)

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/defaults.ts` | Add conversion constants, work hours, fueling/tank defaults |
| Create | `src/hos.ts` | Single source of truth for FMCSA HOS constants |
| Modify | `src/transit-time.ts` | Import HOS + fueling constants instead of redefining |
| Modify | `src/trip-simulator.ts` | Import HOS + fueling constants, replace magic numbers |
| Modify | `src/trip-defaults.ts` | Reference constants instead of hardcoded values |
| Modify | `src/index.ts` | Export new `hos.ts` module |
| Delete | `src/types/lane-confidence.ts` | Dead type — never populated by backend |
| Modify | `src/types/round-trip.ts` | Remove `lane_confidence` field, simplify `type` to `'firm'` |
| Modify | `src/types/index.ts` | Remove lane-confidence re-export |

### haulvisor-backend (Phase 2)

| Action | File | Purpose |
|--------|------|---------|
| Delete | `api/src/lane-confidence/` | Entire dead module (3 files) |
| Modify | `api/src/routes/round-trip.service.ts` | Remove `if (false)` block, LaneConfidence import/injection |
| Modify | `api/src/routes/round-trip.service.spec.ts` | Remove LaneConfidence test references |
| Modify | `api/src/routes/routes.module.ts` | Remove LaneConfidenceModule import |
| Modify | `api/src/routes/routes.service.ts` | Replace hardcoded 1609.34, 55, 6, 16 with core constants |
| Modify | `api/src/routes/round-trip.service.ts` | Replace hardcoded 1609.34, 3_600_000, 55, 6 with core constants |
| Modify | `api/src/routes/suggested-departure.ts` | Replace 3_600_000 with core constant |
| Modify | `api/src/routes/driving-distance.service.ts` | Replace 1609.34 with core constant |

### haulvisor (Phase 3)

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/features/routes/views/desktop/location-sidebar.tsx` | Remove ConfidenceBadge, speculative rendering |
| Modify | `src/features/routes/views/desktop/route-detail-panel.tsx` | Remove ConfidenceBadge, speculative rendering |
| Modify | `src/features/routes/views/desktop/route-row.tsx` | Remove hasSpeculative check |

---

### Task 1: Add shared constants to haulvisor-core defaults.ts

**Repo:** haulvisor-core
**Files:**
- Modify: `src/defaults.ts`

- [ ] **Step 1: Add conversion constants and missing defaults to defaults.ts**

Add these at the end of `src/defaults.ts`:

```typescript
// ── Unit conversions ────────────────────────────────────────────────────────

/** Meters per mile — for converting between PostGIS (meters) and display (miles) */
export const METERS_PER_MILE = 1609.34;

/** Milliseconds per hour */
export const MS_PER_HOUR = 3_600_000;

/** Milliseconds per day */
export const MS_PER_DAY = 86_400_000;

/** Hours per day (for readability in day-from-hours calculations) */
export const HOURS_PER_DAY = 24;

// ── Working hours defaults ──────────────────────────────────────────────────

/** Default earliest hour a driver starts their work day (6 AM) */
export const DEFAULT_WORK_START_HOUR = 6;

/** Default latest hour a driver ends their work day (4 PM) */
export const DEFAULT_WORK_END_HOUR = 16;

// ── Fueling defaults ────────────────────────────────────────────────────────

/** Default fuel tank capacity in gallons (typical Class 8 dual saddle tanks) */
export const DEFAULT_TANK_SIZE_GALLONS = 150;

/** Default average MPG for fueling range calculation */
export const DEFAULT_AVG_MPG = 6.0;

/** Fraction of tank capacity treated as usable range (reserve margin) */
export const TANK_USABLE_FRACTION = 0.9;

/** Refuel when tank is this fraction depleted (triggers end-of-day fueling) */
export const FUEL_THRESHOLD_FRACTION = 0.5;

/** Miles between fueling stops (based on typical tank range) */
export const DEFAULT_FUELING_INTERVAL_MILES = 500;

/** Duration of each fueling stop in hours */
export const DEFAULT_FUELING_STOP_HOURS = 0.5;

/** Average dwell time at each pickup/delivery stop (hours) */
export const DEFAULT_DWELL_HOURS_PER_STOP = 2;
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add src/defaults.ts
git commit -m "feat: add conversion constants and missing defaults"
```

---

### Task 2: Extract HOS constants to shared module

**Repo:** haulvisor-core
**Files:**
- Create: `src/hos.ts`
- Modify: `src/transit-time.ts`
- Modify: `src/trip-simulator.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create src/hos.ts**

```typescript
/**
 * FMCSA Hours of Service Constants
 *
 * Federal law — not user-configurable. Single source of truth for all
 * HOS-related limits used by transit-time and trip-simulator modules.
 *
 * @see https://www.fmcsa.dot.gov/hours-service/elds/drivers-hours-service-rules
 */

/**
 * FMCSA §395.3(a)(3)(i) — 11-Hour Driving Limit
 * A driver may drive a maximum of 11 hours after 10 consecutive hours off duty.
 */
export const HOS_MAX_DRIVING_HOURS = 11;

/**
 * FMCSA §395.3(a)(2) — 14-Hour On-Duty Window
 * A driver may not drive beyond the 14th consecutive hour after coming on duty,
 * following 10 consecutive hours off duty.
 */
export const HOS_ON_DUTY_WINDOW_HOURS = 14;

/**
 * FMCSA §395.3(a)(3)(ii) — 30-Minute Break Requirement
 * A driver must take a 30-minute break before driving if 8 consecutive hours
 * have passed since the last off-duty or sleeper-berth period of at least
 * 30 minutes.
 */
export const HOS_BREAK_TRIGGER_HOURS = 8;

/** Mandatory break duration in hours (30 minutes) */
export const HOS_MANDATORY_BREAK_HOURS = 0.5;

/**
 * FMCSA §395.3(a)(1) — 10-Hour Off-Duty Requirement
 * A driver must have 10 consecutive hours off duty before driving.
 */
export const HOS_MANDATORY_REST_HOURS = 10;
```

- [ ] **Step 2: Update src/transit-time.ts — replace local HOS + fueling constants with imports**

Remove lines 66–103 (the HOS constants section and default values section). Replace with imports:

```typescript
import {
  HOS_MAX_DRIVING_HOURS,
  HOS_ON_DUTY_WINDOW_HOURS,
  HOS_BREAK_TRIGGER_HOURS,
  HOS_MANDATORY_BREAK_HOURS,
  HOS_MANDATORY_REST_HOURS,
} from './hos.js';

import {
  DEFAULT_AVG_SPEED_MPH,
  DEFAULT_AVG_DRIVING_HOURS_PER_DAY,
  DEFAULT_DWELL_HOURS_PER_STOP,
  DEFAULT_FUELING_INTERVAL_MILES,
  DEFAULT_FUELING_STOP_HOURS,
} from './defaults.js';
```

Remove the old import block (lines 15–18) and the local constant declarations (lines 73–103).

- [ ] **Step 3: Update src/trip-simulator.ts — replace local HOS + fueling constants with imports**

Remove lines 166–183 (the two constant sections). Replace with imports from hos.ts and defaults.ts. Update the existing defaults.ts import to include the new constants:

```typescript
import {
  DEFAULT_AVG_SPEED_MPH,
  DEFAULT_AVG_DRIVING_HOURS_PER_DAY,
  DEFAULT_LOADED_SPEED_MPH,
  DEFAULT_LOADING_HOURS,
  DEFAULT_UNLOADING_HOURS,
  DEFAULT_FUELING_INTERVAL_MILES,
  DEFAULT_FUELING_STOP_HOURS,
  DEFAULT_WORK_START_HOUR,
  DEFAULT_WORK_END_HOUR,
  DEFAULT_TANK_SIZE_GALLONS,
  DEFAULT_AVG_MPG,
  TANK_USABLE_FRACTION,
  FUEL_THRESHOLD_FRACTION,
  MS_PER_HOUR,
  HOURS_PER_DAY,
} from './defaults.js';

import {
  HOS_MAX_DRIVING_HOURS,
  HOS_ON_DUTY_WINDOW_HOURS,
  HOS_BREAK_TRIGGER_HOURS,
  HOS_MANDATORY_BREAK_HOURS,
  HOS_MANDATORY_REST_HOURS,
} from './hos.js';
```

Also replace inline magic numbers:
- Line 212: `settings?.tank_size_gallons ?? 150` → `settings?.tank_size_gallons ?? DEFAULT_TANK_SIZE_GALLONS`
- Line 213: `settings?.avg_mpg ?? 6.0` → `settings?.avg_mpg ?? DEFAULT_AVG_MPG`
- Line 215: `tank * mpg * 0.9` → `tank * mpg * TANK_USABLE_FRACTION`
- Line 272: `3600_000` → `MS_PER_HOUR`
- Line 302: `s.fueling_interval_miles * 0.5` → `s.fueling_interval_miles * FUEL_THRESHOLD_FRACTION`
- Line 468: `3_600_000` → `MS_PER_HOUR`
- Line 557: `3600_000` → `MS_PER_HOUR`
- Line 746: `Math.ceil(totalHours / 24)` → `Math.ceil(totalHours / HOURS_PER_DAY)`

- [ ] **Step 4: Add hos.ts to src/index.ts**

```typescript
export * from './hos.js';
```

- [ ] **Step 5: Update src/trip-defaults.ts — reference constants instead of hardcoded values**

Update the import block to include the new constants:

```typescript
import {
  DEFAULT_AVG_SPEED_MPH,
  DEFAULT_AVG_DRIVING_HOURS_PER_DAY,
  DEFAULT_LOADED_SPEED_MPH,
  DEFAULT_LOADING_HOURS,
  DEFAULT_UNLOADING_HOURS,
  DEFAULT_FUELING_INTERVAL_MILES,
  DEFAULT_FUELING_STOP_HOURS,
  DEFAULT_WORK_START_HOUR,
  DEFAULT_WORK_END_HOUR,
} from './defaults.js';
```

Replace hardcoded values in the TRIP_DEFAULTS object:
- `fueling_interval_miles.value: 500` → `value: DEFAULT_FUELING_INTERVAL_MILES`
- `fueling_stop_hours.value: 0.5` → `value: DEFAULT_FUELING_STOP_HOURS`
- `work_start_hour.value: 6` → `value: DEFAULT_WORK_START_HOUR`
- `work_end_hour.value: 16` → `value: DEFAULT_WORK_END_HOUR`

Note: The `as const satisfies` will need adjustment since the values are no longer literals. Change to `satisfies Record<string, ModelDefault>` (drop `as const`).

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 7: Commit**

```bash
git add src/hos.ts src/transit-time.ts src/trip-simulator.ts src/trip-defaults.ts src/index.ts
git commit -m "refactor: deduplicate HOS constants, extract magic numbers to named defaults"
```

---

### Task 3: Remove LaneConfidence type from haulvisor-core

**Repo:** haulvisor-core
**Files:**
- Delete: `src/types/lane-confidence.ts`
- Modify: `src/types/round-trip.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Remove lane_confidence field and speculative type from RoundTripLeg**

In `src/types/round-trip.ts`:

Remove line 1 (the import):
```typescript
import type { LaneConfidence } from './lane-confidence.js';
```

Change line 7:
```typescript
  type: 'firm' | 'speculative';
```
to:
```typescript
  type: 'firm';
```

Remove line 27:
```typescript
  lane_confidence?: LaneConfidence;
```

- [ ] **Step 2: Remove lane-confidence from types index**

In `src/types/index.ts`, remove line 8:
```typescript
export * from './lane-confidence.js';
```

- [ ] **Step 3: Delete the type file**

```bash
rm src/types/lane-confidence.ts
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "chore: remove dead LaneConfidence type and speculative leg support"
git push origin main
```

CI will auto-publish a new version to GitHub Packages.

---

### Task 4: Remove lane-confidence dead code from haulvisor-backend

**Repo:** haulvisor-backend
**Files:**
- Delete: `api/src/lane-confidence/lane-confidence.module.ts`
- Delete: `api/src/lane-confidence/lane-confidence.service.ts`
- Delete: `api/src/lane-confidence/lane-confidence.service.spec.ts`
- Modify: `api/src/routes/round-trip.service.ts`
- Modify: `api/src/routes/round-trip.service.spec.ts`
- Modify: `api/src/routes/routes.module.ts`

- [ ] **Step 1: Update @mwbhtx/haulvisor-core**

```bash
npm update @mwbhtx/haulvisor-core
```

- [ ] **Step 2: Delete the lane-confidence directory**

```bash
rm -rf api/src/lane-confidence
```

- [ ] **Step 3: Remove LaneConfidence from round-trip.service.ts**

Remove the import (line 3):
```typescript
import { LaneConfidenceService } from '../lane-confidence/lane-confidence.service';
```

Remove from constructor — change:
```typescript
constructor(
  private readonly postgres: PostgresService,
  private readonly laneConfidenceService: LaneConfidenceService,
  private readonly settingsService: SettingsService,
  private readonly distanceService: DrivingDistanceService,
  private readonly companiesService: CompaniesService,
) {}
```
to:
```typescript
constructor(
  private readonly postgres: PostgresService,
  private readonly settingsService: SettingsService,
  private readonly distanceService: DrivingDistanceService,
  private readonly companiesService: CompaniesService,
) {}
```

Delete the entire `if (false) { ... }` block (lines 574–666).

- [ ] **Step 4: Remove LaneConfidence from round-trip.service.spec.ts**

Remove the LaneConfidenceService import and any mock/provider references in the test file.

- [ ] **Step 5: Remove LaneConfidenceModule from routes.module.ts**

Remove the import line:
```typescript
import { LaneConfidenceModule } from '../lane-confidence/lane-confidence.module';
```

Remove from the imports array — change:
```typescript
imports: [SettingsModule, LaneConfidenceModule, CompaniesModule],
```
to:
```typescript
imports: [SettingsModule, CompaniesModule],
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove dead lane-confidence module and speculative leg code"
```

---

### Task 5: Replace backend hardcoded values with core constants

**Repo:** haulvisor-backend
**Files:**
- Modify: `api/src/routes/routes.service.ts`
- Modify: `api/src/routes/round-trip.service.ts`
- Modify: `api/src/routes/suggested-departure.ts`
- Modify: `api/src/routes/driving-distance.service.ts`

- [ ] **Step 1: Update imports in each file to include new core constants**

Each file needs its import from `@mwbhtx/haulvisor-core` expanded. Add the relevant constants:

For files using `1609.34`: add `METERS_PER_MILE`
For files using `3_600_000`: add `MS_PER_HOUR`
For files using `55` as speed: add `DEFAULT_AVG_SPEED_MPH`
For files using `6`/`16` as work hours: add `DEFAULT_WORK_START_HOUR`, `DEFAULT_WORK_END_HOUR`

- [ ] **Step 2: Replace hardcoded values in routes.service.ts**

- All `1609.34` → `METERS_PER_MILE` (lines ~61, ~136)
- `?? 6` for workStartHour → `?? DEFAULT_WORK_START_HOUR` (line ~154)
- `?? 16` for workEndHour → `?? DEFAULT_WORK_END_HOUR` (line ~155)
- `55` in computeSuggestedDeparture → `DEFAULT_AVG_SPEED_MPH` (line ~318)
- `3_600_000` → `MS_PER_HOUR` (lines ~544, ~560, ~571)

Note: The `1609.34` inside SQL query strings must stay as literal values — they're sent to PostgreSQL, not evaluated in TypeScript.

- [ ] **Step 3: Replace hardcoded values in round-trip.service.ts**

- `1609.34` → `METERS_PER_MILE` (line ~326, keep SQL literals as-is)
- `3_600_000` → `MS_PER_HOUR` (lines ~442, ~451, ~873, ~889, ~903, ~914)
- `55` in computeSuggestedDeparture → `DEFAULT_AVG_SPEED_MPH` (lines ~540, ~662, ~835)
- `?? 6` for work_start_hour → `?? DEFAULT_WORK_START_HOUR` (lines ~540, ~662, ~835)

- [ ] **Step 4: Replace hardcoded values in suggested-departure.ts**

- `3_600_000` → `MS_PER_HOUR` (line ~24)

Add import:
```typescript
import { MS_PER_HOUR } from '@mwbhtx/haulvisor-core';
```

- [ ] **Step 5: Replace hardcoded values in driving-distance.service.ts**

- `1609.34` → `METERS_PER_MILE` (line ~87)

Add import:
```typescript
import { METERS_PER_MILE } from '@mwbhtx/haulvisor-core';
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: replace hardcoded values with haulvisor-core constants"
```

---

### Task 6: Remove dead speculative rendering code from haulvisor frontend

**Repo:** haulvisor
**Files:**
- Modify: `src/features/routes/views/desktop/location-sidebar.tsx`
- Modify: `src/features/routes/views/desktop/route-detail-panel.tsx`
- Modify: `src/features/routes/views/desktop/route-row.tsx`

- [ ] **Step 1: Update @mwbhtx/haulvisor-core**

```bash
npm update @mwbhtx/haulvisor-core
```

- [ ] **Step 2: Clean up location-sidebar.tsx**

Remove the `ConfidenceBadge` component definition (line ~20-24).

Remove the `hasSpeculative` check and all speculative-leg logic:
- Lines ~346-360: `hasSpeculative`, `speculativeLegs`, `highestConfidenceSpecLeg` variables
- Lines ~576-603: Conditional speculative rendering (the `leg.type === "speculative"` ternary and `lane_confidence` badge block)

Replace any `leg.type === "speculative" ? "text-text-body" : "text-positive"` ternary with just `"text-positive"`.

Replace `leg.type === "speculative" ? `~${formatCurrency(leg.pay)}` : formatCurrency(leg.pay)` with just `formatCurrency(leg.pay)`.

Remove the `lane_confidence ? ... : null` from the miles info line.

- [ ] **Step 3: Clean up route-detail-panel.tsx**

Remove the `ConfidenceBadge` component definition (line ~13-17).

Remove the `hasSpeculative` variable (line ~131).

Remove the `lane_confidence` display block (lines ~359-371).

- [ ] **Step 4: Clean up route-row.tsx**

Remove the `hasSpeculative` variable (line ~26) and any code that depends on it.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: Clean compilation

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove dead speculative leg rendering code"
```
