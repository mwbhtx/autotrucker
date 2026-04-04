# Mapbox to Free Stack Migration

**Date:** 2026-04-04
**Status:** Approved
**Approach:** Big bang swap (Approach A) — all three services replaced in one branch

## Goal

Replace Mapbox entirely with a free/near-free stack to eliminate Mapbox billing. The migration surface is small (3 files + CSS + config), so a single-branch swap is the right approach.

## Target Stack

| Service | Current (Mapbox) | New |
|---------|-----------------|-----|
| Map rendering | mapbox-gl v3.20 + Mapbox tile servers | MapLibre GL JS + Protomaps PMTiles |
| Tile hosting | Mapbox servers | S3 + CloudFront or Cloudflare R2 (TBD) |
| Directions | Mapbox Directions API | OpenRouteService (`driving-hgv` profile) |
| Geocoding | Mapbox Geocoding v5 | LocationIQ (autocomplete + reverse) |

## Scope

CONUS only (continental United States — excluding Alaska and Hawaii). No international data needed. This keeps the PMTiles file small.

## Files Changed

| File | Change |
|------|--------|
| `src/features/routes/components/route-map.tsx` | Swap mapboxgl → maplibregl, replace style URL with Protomaps style object, swap directions fetch to ORS |
| `src/features/routes/components/search-form.tsx` | Swap Mapbox geocoding calls to LocationIQ autocomplete + reverse |
| `src/core/utils/map/draw-route.ts` | Update `FetchDirections` implementation to call ORS instead of Mapbox |
| `src/app/globals.css` | Swap CSS import to maplibre-gl, remove dark/light brightness/contrast filter hacks, update `.mapboxgl-*` selectors to `.maplibregl-*` |
| `package.json` | Remove `mapbox-gl`, add `maplibre-gl` + `pmtiles` |
| `.env.example` | Remove `NEXT_PUBLIC_MAPBOX_TOKEN`, add `NEXT_PUBLIC_PMTILES_URL`, `NEXT_PUBLIC_ORS_API_KEY`, `NEXT_PUBLIC_LOCATIONIQ_KEY` |

## Section 1: Map Rendering — MapLibre GL JS + Protomaps

### Dependencies

- Remove `mapbox-gl` from package.json
- Add `maplibre-gl` and `pmtiles` packages

### Map Initialization

In `route-map.tsx`:

- Replace `import mapboxgl from "mapbox-gl"` with `import maplibregl from "maplibre-gl"`
- Remove `mapboxgl.accessToken = MAPBOX_TOKEN`
- Register the PMTiles protocol with MapLibre before map init
- Replace map constructor: use `maplibregl.Map` with a Protomaps style object instead of a Mapbox style URL
- Globe projection: MapLibre v4+ supports globe projection, so the desktop/mobile projection logic carries over unchanged

### Themes

Two Protomaps flavor objects, color-matched to the current Mapbox themes using exported Mapbox style JSONs as reference:

- **Light theme:** Custom flavor approximating the current Mapbox "Moonlight" style (muted, desaturated palette). User will export the Mapbox style JSON (`cmncvt3ha007401qs35xhdqfg`) to extract exact hex values for land, water, roads, labels, buildings.
- **Dark theme:** Customize Protomaps' built-in `dark` flavor to approximate Mapbox `dark-v11`.

The CSS brightness/contrast filter hack in `globals.css` (`.dark .mapboxgl-map { filter: brightness(2.05) contrast(1.75) }`) is removed — proper dark Protomaps theme replaces it.

### Tile Hosting

- Generate a CONUS-only PMTiles extract (e.g., from Protomaps' planet file or OpenStreetMap data)
- Host on S3 + CloudFront or Cloudflare R2 (decision deferred to implementation — both work identically from the frontend's perspective, just a URL)
- Frontend references tiles via `NEXT_PUBLIC_PMTILES_URL` env var

## Section 2: Directions — OpenRouteService

### API Swap

Replace the Mapbox Directions API call with OpenRouteService:

- **Endpoint:** `https://api.openrouteservice.org/v2/directions/driving-hgv`
- **Profile:** `driving-hgv` (heavy goods vehicle — appropriate for a trucking app)
- **Purpose:** Draw route polylines on the map only. No turn-by-turn navigation, no maneuvers, no step-by-step instructions. Just the geometry for visual reference.
- **Response:** ORS returns GeoJSON geometries, same as Mapbox, so existing route drawing logic (`drawRouteChain`, layer updates, cleanup) stays as-is

### Integration Points

- The `FetchDirections` type in `draw-route.ts` already abstracts the directions call — swap the implementation behind it
- The `directionsCache` Map in `route-map.tsx` continues working (keyed by coordinates, provider-agnostic)
- Two-phase rendering (arcs first, then road geometry) stays unchanged
- Graceful fallback to arc geometry on API failure stays unchanged
- Add `NEXT_PUBLIC_ORS_API_KEY` env var

### Rate Limits

- Free tier: 2,000 direction requests/day
- Directions only fire when a user views a specific route detail (not on list view), so this should be sufficient
- If outgrown: self-host ORS via Docker for unlimited requests

## Section 3: Geocoding — LocationIQ

### Forward Geocoding (Autocomplete)

Replace Mapbox geocoding in `search-form.tsx`:

- **Endpoint:** `https://us1.locationiq.com/v1/autocomplete`
- **Parameters:** `key={key}&q={query}&countrycodes=us&limit=5&tag=place:city,place:town`
- **Response mapping:** Map LocationIQ's `display_name`, `lat`, `lon` to existing `PlaceResult` type (`{ name, lat, lng }`)
- Keep existing 300ms debounce

### Reverse Geocoding ("Use My Location")

- **Endpoint:** `https://us1.locationiq.com/v1/reverse`
- **Parameters:** `key={key}&lat={lat}&lon={lon}&format=json`
- **Fallback:** Same as current — if geocoding fails, display coordinates

### Environment

- Add `NEXT_PUBLIC_LOCATIONIQ_KEY` env var

## Section 4: Cleanup

- Remove `NEXT_PUBLIC_MAPBOX_TOKEN` from `.env.example`
- Remove `@import "mapbox-gl/dist/mapbox-gl.css"` from `globals.css`, replace with `@import "maplibre-gl/dist/maplibre-gl.css"`
- Remove `.dark .mapboxgl-map` and `.light .mapboxgl-map` CSS filter rules
- Update any `.mapboxgl-*` CSS selectors to `.maplibregl-*`
- Verify no other files reference Mapbox (grep for `mapbox` across codebase)

## Environment Variables Summary

| Remove | Add |
|--------|-----|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `NEXT_PUBLIC_PMTILES_URL` |
| | `NEXT_PUBLIC_ORS_API_KEY` |
| | `NEXT_PUBLIC_LOCATIONIQ_KEY` |

## Testing

- Visual verification: map renders in both light and dark themes
- Route polylines draw correctly with ORS directions
- Autocomplete returns US cities for partial queries
- Reverse geocoding works for "Use My Location"
- Arc fallback works when ORS is unavailable
- Mobile and desktop projections work (mercator/globe)
- Theme switching works dynamically
