# Map Stack Documentation

Haulvisor uses a fully open-source/free-tier map stack across the frontend and backend. This document covers every service, how the app uses it, cost limits, and configuration.

## Services Overview

| Service | Purpose | Used In | Free Tier (2026) |
|---------|---------|---------|-----------------|
| [Protomaps](https://protomaps.com) | Vector tile rendering | Frontend | Free for non-commercial; commercial requires GitHub Sponsorship |
| [MapLibre GL JS](https://maplibre.org) | Map rendering library | Frontend | Open source, unlimited |
| [OpenRouteService](https://openrouteservice.org) | Route polylines (HGV profile) | Frontend | 2,000 direction requests/day |
| [LocationIQ](https://locationiq.com) | Geocoding (autocomplete + reverse + search) | Frontend + Backend | 5,000 requests/day |

## Cost Limits and Rate Budgets

### Protomaps

- Free for non-commercial use. Commercial use requires a [GitHub Sponsorship](https://github.com/sponsors/protomaps).
- Tile requests are not individually rate-limited, but abuse will result in key revocation.
- No per-request billing. Cost is the sponsorship fee if commercial.

### OpenRouteService

- **2,000 direction requests/day** on the free plan.
- Directions only fire when a user views a specific route detail (not on list view).
- Results are cached client-side in a `directionsCache` Map, so scrolling between route cards does not re-fetch.
- If the free tier is outgrown, self-host ORS via Docker for unlimited requests.

### LocationIQ

- **5,000 requests/day** across all endpoints (autocomplete, reverse, search).
- Frontend autocomplete uses 300ms debounce to limit calls during typing.
- Backend geocoding results are cached in DynamoDB (`haulvisor-geocode-cache`) with 90-day TTL, so each unique "City, ST" is only geocoded once.
- One API key shared between frontend and backend (free plan allows 1 token).
- **Domain restriction** is available in the LocationIQ dashboard to prevent key abuse from unauthorized origins.

---

## Frontend Usage

### Map Rendering (`route-map.tsx`)

**Component:** `RouteMap`

The core map component. Initializes a MapLibre GL JS map with Protomaps vector tiles and custom monochrome themes.

**Initialization:**
- Creates a `maplibregl.Map` with tiles from `api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt`
- Centers on the continental US (`[-95.7, 37.1]`, zoom 4)
- No globe projection (mercator only)

**Theme switching:**
- Two custom themes defined in `src/core/utils/map/themes.ts`:
  - `MOONLIGHT_THEME` — monochrome light gray (light mode)
  - `DARK_THEME` — monochrome dark gray (dark mode)
- Themes are applied via `layersWithCustomTheme()` from `protomaps-themes-base`
- Switches automatically when the user toggles light/dark mode via `next-themes`

**Route drawing (two-phase):**
1. **Phase 1 (instant):** Draws straight lines between leg endpoints for immediate visual feedback
2. **Phase 2 (async):** Fetches real road-following geometries from OpenRouteService in parallel, swaps them in as they resolve

**Layers rendered:**
- `route-leg-{i}` — colored lines for each leg (colors from `LEG_COLORS`)
- `route-deadhead-{i}` — dashed red lines for deadhead segments between legs
- `route-dh-start` — dashed line from origin to first pickup
- `route-dh-return` — dashed line from last dropoff to destination
- `route-endpoints` — green circle at first pickup
- `route-endpoints-flag` — checkered flag icon at final destination

**Interactive features:**
- `fitBounds` auto-zooms to show the full route with padding
- Hover highlighting: hovered leg gets `line-width: 7`, others fade to `opacity: 0.2`
- Legend overlay showing leg colors and deadhead indicator

### Directions (`route-map.tsx`)

**Endpoint:** `https://api.openrouteservice.org/v2/directions/driving-hgv`

- Uses the `driving-hgv` (Heavy Goods Vehicle) profile for truck-appropriate routing
- Only fetches geometry — no turn-by-turn instructions or maneuvers
- Auth via `Authorization` header with the ORS API key
- Response format: GeoJSON FeatureCollection, coordinates at `features[0].geometry.coordinates`
- Results cached in a module-level `directionsCache` Map keyed by `"lng,lat;lng,lat"`
- Falls back to straight lines if the API call fails

### Geocoding — Autocomplete (`search-form.tsx`)

**Function:** `searchPlaces(query)`

**Endpoint:** `https://us1.locationiq.com/v1/autocomplete`

| Parameter | Value |
|-----------|-------|
| `key` | `NEXT_PUBLIC_LOCATIONIQ_KEY` |
| `q` | User's typed query |
| `countrycodes` | `us` |
| `limit` | `5` |
| `tag` | `place:city,place:town` |

- Triggered on input change with 300ms debounce
- Returns results as `PlaceResult[]` with `{ name: "City, State", lat, lng }`
- Name formatted from `address.city` or `address.town` + `address.state` (never shows country)
- Used by the `PlaceAutocomplete` component for origin/destination selection

### Geocoding — Reverse (`search-form.tsx`)

**Function:** `handleUseMyLocation()`

**Endpoint:** `https://us1.locationiq.com/v1/reverse`

| Parameter | Value |
|-----------|-------|
| `key` | `NEXT_PUBLIC_LOCATIONIQ_KEY` |
| `lat` | Browser geolocation latitude |
| `lon` | Browser geolocation longitude |
| `format` | `json` |

- Triggered by "Use My Location" button
- Resolves browser coordinates to a city name
- Falls back to raw coordinates (`"29.76, -95.37"`) if the API call fails
- Requires HTTPS (or localhost) for browser geolocation access

### Map Utilities (`draw-route.ts`)

Provider-agnostic utilities used by `RouteMap`:

| Function | Purpose |
|----------|---------|
| `cleanupRouteLayers(map)` | Removes all route layers and sources from the map |
| `greatCircleArc(origin, dest)` | Generates smooth arc coordinates between two points (Phase 1) |
| `updateSourceCoords(map, id, coords)` | Updates a GeoJSON source's coordinates in place |
| `drawRouteChain(map, route, fetchDirections, isCancelled)` | Full two-phase route drawing with cancellation support |

The `MapLike` interface abstracts the map methods used, enabling unit testing without a real map instance. Tests are in `src/__tests__/draw-route.test.ts`.

### Custom Themes (`themes.ts`)

Two monochrome themes matching the original Mapbox Moonlight aesthetic:

| Theme | Background | Features | Water |
|-------|-----------|----------|-------|
| `MOONLIGHT_THEME` (light) | `#e5e5e5` | `#1a1a1a` range | `#1a1a1a` |
| `DARK_THEME` (dark) | `#1a1a1a` | `#e5e5e5` range | `#e5e5e5` |

Each theme defines 80+ color tokens covering background, earth, water, roads (by hierarchy), buildings, tunnels, bridges, railways, boundaries, and label text/halos.

---

## Backend Usage

### Geocoding Worker Lambda (`handler.ts`)

**Function:** `haulvisor-geocoding`

Processes orders from an SQS queue and resolves missing coordinates and timezones.

**Flow:**
1. Receives SQS message with `{ companyId, orderIds }`
2. For each order:
   - If `origin_lat` is null: geocodes `"origin_city, origin_state"` via LocationIQ
   - If `destination_lat` is null: geocodes `"destination_city, destination_state"` via LocationIQ
   - For each stopoff without a timezone: geocodes city/state, looks up timezone via `geo-tz`, converts local dates to UTC
3. Updates the order in DynamoDB with resolved coordinates and UTC dates

**Geocode function:**
- **Endpoint:** `https://us1.locationiq.com/v1/search`
- Checks DynamoDB cache first (`haulvisor-geocode-cache` table)
- On cache miss: calls LocationIQ, stores result with 90-day TTL
- Auth via `LOCATIONIQ_PRIVATE_KEY` env var (from SSM Parameter Store)

**Trigger:** Orders are enqueued by the API's `batchUpsert()` endpoint when new orders arrive from the scraper. Order IDs are chunked into batches of 25 per SQS message.

### Settings Service (`settings.service.ts`)

When a user sets their home base city/state in settings, the service resolves coordinates:

1. Checks DynamoDB geocode cache
2. On cache miss: calls LocationIQ search API
3. Stores result with 30-day TTL
4. Updates user record with `home_base_lat` / `home_base_lng`

### Geocode Orders Script (`geocode-orders.ts`)

Backfill script for orders missing coordinates:

```bash
npm run db:geocode
```

Scans all orders where `origin_lat` is null, geocodes each via LocationIQ, and updates DynamoDB. Uses the same cache table to avoid redundant API calls.

---

## Infrastructure

### Environment Variables

**Frontend (baked into build via `NEXT_PUBLIC_` prefix):**

| Variable | Source | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_PROTOMAPS_API_KEY` | GitHub Secret | Protomaps tile API key |
| `NEXT_PUBLIC_ORS_API_KEY` | GitHub Secret | OpenRouteService directions API key |
| `NEXT_PUBLIC_LOCATIONIQ_KEY` | GitHub Secret | LocationIQ geocoding API key |

**Backend (Lambda environment, from Terraform):**

| Variable | Source | Purpose |
|----------|--------|---------|
| `LOCATIONIQ_PRIVATE_KEY` | SSM Parameter Store (`/${project}/locationiq/private-key`) | LocationIQ server-side geocoding |
| `GEOCODE_CACHE_TABLE` | Terraform resource | DynamoDB geocode cache table name |
| `ORDERS_TABLE` | Terraform resource | DynamoDB orders table name |
| `SQS_GEOCODING_QUEUE_URL` | Terraform resource | Geocoding queue URL |

### DynamoDB Geocode Cache

| Attribute | Type | Description |
|-----------|------|-------------|
| `location_key` | String (hash key) | Lowercased location string (e.g. `"denver, co"`) |
| `lat` | Number | Latitude |
| `lng` | Number | Longitude |
| `ttl` | Number | Unix timestamp for DynamoDB TTL auto-cleanup |

TTL values: 90 days (Lambda/script), 30 days (settings service).

---

## Security

- **Frontend keys** (`NEXT_PUBLIC_*`) are embedded in the client bundle and visible in browser dev tools. Use **domain restrictions** in each provider's dashboard to prevent abuse from unauthorized origins.
- **Backend key** (`LOCATIONIQ_PRIVATE_KEY`) is stored in AWS SSM Parameter Store as a SecureString and injected into Lambda environment at deploy time. Never exposed to the client.
- The same LocationIQ API key is used for both frontend and backend (free plan allows 1 token). Domain restrictions in LocationIQ apply only to the frontend; backend calls come from Lambda IPs and are not restricted by referer.
- ORS does not support domain restrictions on the free tier. If abuse becomes a concern, proxy ORS calls through the backend API.
