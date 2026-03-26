import { describe, it, expect, vi, beforeEach } from "vitest";
import { drawRouteChain, cleanupRouteLayers, type MapLike, type RouteChainLike } from "@/lib/map/draw-route";

/** Create a mock map that tracks which sources/layers exist */
function createMockMap(): MapLike & {
  sources: Set<string>;
  layers: Set<string>;
  addSourceCalls: string[];
  addLayerCalls: string[];
} {
  const sources = new Set<string>();
  const layers = new Set<string>();
  const addSourceCalls: string[] = [];
  const addLayerCalls: string[] = [];

  return {
    sources,
    layers,
    addSourceCalls,
    addLayerCalls,
    getLayer: (id: string) => layers.has(id) ? {} : undefined,
    removeLayer: (id: string) => { layers.delete(id); },
    getSource: (id: string) => sources.has(id) ? {} : undefined,
    removeSource: (id: string) => { sources.delete(id); },
    addSource: (id: string, _source: unknown) => { sources.add(id); addSourceCalls.push(id); },
    addLayer: (layer: unknown) => {
      const id = (layer as any).id;
      layers.add(id);
      addLayerCalls.push(id);
    },
    hasImage: () => false,
    addImage: () => {},
    fitBounds: () => {},
    getZoom: () => 4,
    isStyleLoaded: () => true,
  };
}

function makeLeg(origin: [string, number, number], dest: [string, number, number]) {
  return {
    order_id: `order-${origin[0]}-${dest[0]}`,
    origin_city: origin[0],
    origin_state: "TX",
    origin_lat: origin[1],
    origin_lng: origin[2],
    destination_city: dest[0],
    destination_state: "FL",
    destination_lat: dest[1],
    destination_lng: dest[2],
    pay: 1000,
    miles: 500,
    trailer_type: "V",
    deadhead_miles: 50,
  };
}

const routeA: RouteChainLike = {
  legs: [
    makeLeg(["Houston", 29.76, -95.37], ["Tampa", 27.95, -82.46]),
    makeLeg(["Jacksonville", 30.33, -81.66], ["Dallas", 32.78, -96.80]),
  ],
};

const routeB: RouteChainLike = {
  legs: [
    makeLeg(["Austin", 30.27, -97.74], ["Miami", 25.76, -80.19]),
  ],
};

// RoundTripLeg has extra fields beyond DrawableRouteLeg — confirm they don't break drawing
const homeLeg = {
  ...makeLeg(["Houston", 29.76, -95.37], ["Tampa", 27.95, -82.46]),
  leg_number: 1,
  type: "firm" as const,
};
const routeHome: RouteChainLike = { legs: [homeLeg] };

describe("drawRouteChain", () => {
  let map: ReturnType<typeof createMockMap>;
  let instantFetch: (o: [number, number], d: [number, number]) => Promise<[number, number][]>;

  beforeEach(() => {
    map = createMockMap();
    instantFetch = async (o, d) => [o, d];
  });

  it("draws leg layers on the map for each leg", async () => {
    await drawRouteChain(map, routeA, instantFetch, () => false);

    expect(map.layers.has("route-leg-0")).toBe(true);
    expect(map.layers.has("route-leg-1")).toBe(true);
    expect(map.layers.has("route-deadhead-1")).toBe(true);
  });

  it("cleans up previous layers before drawing", async () => {
    // Draw route A first
    await drawRouteChain(map, routeA, instantFetch, () => false);
    expect(map.layers.has("route-leg-0")).toBe(true);
    expect(map.layers.has("route-leg-1")).toBe(true);

    // Draw route B (single leg) — should remove route A's leg-1
    await drawRouteChain(map, routeB, instantFetch, () => false);
    expect(map.layers.has("route-leg-0")).toBe(true);
    expect(map.layers.has("route-leg-1")).toBe(false);
    expect(map.layers.has("route-deadhead-1")).toBe(false);
  });

  it("does NOT update road geometries when cancelled during fetch", async () => {
    let cancelled = false;
    const setDataCalls: string[] = [];

    // Track setData calls on sources to verify Phase 2 is skipped
    const origAddSource = map.addSource.bind(map);
    map.addSource = (id: string, source: unknown) => {
      origAddSource(id, source);
      // Monkey-patch getSource to return an object with setData tracking
      const origGetSource = map.getSource.bind(map);
      map.getSource = (qid: string) => {
        if (qid === id && map.sources.has(id)) {
          return { setData: () => { setDataCalls.push(qid); } };
        }
        return origGetSource(qid);
      };
    };

    // Slow fetch that gives us time to cancel
    const slowFetch = async (o: [number, number], d: [number, number]): Promise<[number, number][]> => {
      await new Promise((r) => setTimeout(r, 50));
      return [o, d];
    };

    const promise = drawRouteChain(map, routeA, slowFetch, () => cancelled);

    // Cancel while fetches are in flight
    cancelled = true;

    await promise;

    // Phase 1 arcs are drawn synchronously (before cancellation)
    expect(map.addLayerCalls.length).toBeGreaterThan(0);
    // Phase 2 road geometry updates should NOT have happened
    expect(setDataCalls).toHaveLength(0);
  });

  it("prevents stale route from drawing when a newer route supersedes it", async () => {
    // This is the exact race condition that caused the rogue route bug:
    // Route A starts drawing (slow fetch), then Route B starts drawing (fast fetch).
    // Route A's fetches resolve after Route B is already drawn.
    // Without cancellation, Route A's road geometries won't overwrite Route B's arcs.

    let resolveRouteA: () => void;
    const routeABlocked = new Promise<void>((r) => { resolveRouteA = r; });

    let cancelledA = false;
    let cancelledB = false;

    const setDataCalls: string[] = [];
    const origGetSource = map.getSource.bind(map);
    map.getSource = (id: string) => {
      if (map.sources.has(id)) {
        return { setData: () => { setDataCalls.push(id); } };
      }
      return origGetSource(id);
    };

    // Route A uses a slow fetch that blocks until we manually resolve
    const slowFetch = async (o: [number, number], d: [number, number]): Promise<[number, number][]> => {
      await routeABlocked;
      return [o, d];
    };

    // Start drawing route A (will block on fetch)
    const promiseA = drawRouteChain(map, routeA, slowFetch, () => cancelledA);

    // Simulate the effect cleanup: cancel route A
    cancelledA = true;

    // Start drawing route B immediately (fast fetch)
    // This calls cleanupRouteLayers first, removing route A's arc layers
    const promiseB = drawRouteChain(map, routeB, instantFetch, () => cancelledB);
    await promiseB;

    // Route B's single leg should be the only layer on the map
    expect(map.layers.has("route-leg-0")).toBe(true);
    expect(map.layers.has("route-leg-1")).toBe(false);
    expect(map.layers.has("route-deadhead-1")).toBe(false);

    // Now route A's fetch resolves — Phase 2 updates should be skipped
    resolveRouteA!();
    await promiseA;

    // Map should still only have route B's layers
    expect(map.layers.has("route-leg-0")).toBe(true);
    expect(map.layers.has("route-leg-1")).toBe(false);
  });

  it("draws routes with RoundTripLeg-shaped legs", async () => {
    await drawRouteChain(map, routeHome, instantFetch, () => false);
    expect(map.layers.has("route-leg-0")).toBe(true);
  });

  it("handles fetch errors gracefully and falls back to straight lines", async () => {
    const failingFetch = async (): Promise<[number, number][]> => {
      throw new Error("Network error");
    };

    await drawRouteChain(map, routeA, failingFetch, () => false);

    // Should still draw — using straight line fallback coordinates
    expect(map.layers.has("route-leg-0")).toBe(true);
    expect(map.layers.has("route-leg-1")).toBe(true);
  });
});

describe("cleanupRouteLayers", () => {
  it("removes all route layer types", () => {
    const map = createMockMap();

    // Simulate existing layers
    const allIds = [
      "route-line", "route-deadhead", "route-endpoints-flag", "route-endpoints",
      "order-route", "order-endpoints-flag", "order-endpoints",
      "route-leg-0", "route-leg-1", "route-leg-2",
      "route-deadhead-1", "route-deadhead-2",
    ];
    for (const id of allIds) {
      map.sources.add(id);
      map.layers.add(id);
    }

    cleanupRouteLayers(map);

    for (const id of allIds) {
      expect(map.layers.has(id)).toBe(false);
      expect(map.sources.has(id)).toBe(false);
    }
  });
});
