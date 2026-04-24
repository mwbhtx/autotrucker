import { describe, it, expect } from "vitest";
import { buildRoutesCsv, buildRoutesCsvFilename } from "../export-csv";
import type { RouteChain } from "@/core/types";

function makeChain(overrides: Partial<RouteChain> = {}): RouteChain {
  return {
    rank: 1,
    total_pay: 3000,
    total_miles: 800,
    total_deadhead_miles: 150,
    estimated_deadhead_cost: 90,
    profit: 900,
    rate_per_mile: 3.75,
    deadhead_pct: 15.8,
    effective_rpm: 1.12,
    effective_cost_per_mile: 2.63,
    estimated_days: 2,
    daily_net_profit: 450,
    gross_rpm_total: 3.15,
    gross_per_day: 1500,
    cost_breakdown: { total: 2100 },
    legs: [
      {
        leg_number: 1,
        order_id: "ORD-A",
        origin_city: "Dallas",
        origin_state: "TX",
        origin_lat: 32.7,
        origin_lng: -96.8,
        destination_city: "Atlanta",
        destination_state: "GA",
        destination_lat: 33.7,
        destination_lng: -84.4,
        pay: 1500,
        miles: 780,
        deadhead_miles: 150,
        stopoffs: [
          {
            sequence: 1,
            type: "pickup",
            company_name: "Acme Mfg",
            address_1: "123 Main St",
            city: "Dallas",
            state: "TX",
            zip: "75001",
            early_date_local: "2026-04-25 08:00",
            late_date_local: "2026-04-25 10:00",
            early_date_utc: "2026-04-25T13:00:00Z",
            late_date_utc: "2026-04-25T15:00:00Z",
            iana_timezone: "America/Chicago",
          },
          {
            sequence: 2,
            type: "dropoff",
            company_name: "BigBox DC",
            address_1: "99 Oak Ave",
            city: "Atlanta",
            state: "GA",
            zip: "30301",
            early_date_local: "2026-04-26 14:00",
            late_date_local: "2026-04-26 16:00",
            early_date_utc: "2026-04-26T18:00:00Z",
            late_date_utc: "2026-04-26T20:00:00Z",
            iana_timezone: "America/New_York",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("buildRoutesCsvFilename", () => {
  it("formats engine + timestamp with dashes instead of colons", () => {
    const name = buildRoutesCsvFilename("v2", new Date("2026-04-24T14:32:15Z"));
    expect(name).toBe("routes_v2_2026-04-24T14-32-15.csv");
  });

  it("defaults to v1", () => {
    const name = buildRoutesCsvFilename("v1", new Date("2026-01-01T00:00:00Z"));
    expect(name).toBe("routes_v1_2026-01-01T00-00-00.csv");
  });
});

describe("buildRoutesCsv", () => {
  it("produces a header row plus one row per route", () => {
    const csv = buildRoutesCsv([makeChain({ rank: 1 }), makeChain({ rank: 2 })], "v1");
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[0]).toContain("route_rank");
    expect(lines[0]).toContain("stopoffs_json");
  });

  it("joins order_ids with semicolons for multi-leg routes", () => {
    const chain = makeChain({
      legs: [
        { ...makeChain().legs[0], order_id: "ORD-A", leg_number: 1, stopoffs: [] },
        {
          leg_number: 2,
          order_id: "ORD-B",
          origin_city: "Atlanta",
          origin_state: "GA",
          origin_lat: 33.7,
          origin_lng: -84.4,
          destination_city: "Miami",
          destination_state: "FL",
          destination_lat: 25.8,
          destination_lng: -80.2,
          pay: 1500,
          miles: 660,
          deadhead_miles: 0,
          stopoffs: [],
        },
      ],
    });
    const csv = buildRoutesCsv([chain], "v1");
    const dataRow = csv.split("\r\n")[1];
    expect(dataRow).toContain("ORD-A;ORD-B");
  });

  it("wraps cells that contain commas in double quotes", () => {
    // legs_summary will contain commas like "Dallas,TX -> Atlanta,GA"
    const csv = buildRoutesCsv([makeChain()], "v1");
    const dataRow = csv.split("\r\n")[1];
    expect(dataRow).toContain('"Dallas,TX -> Atlanta,GA"');
  });

  it("escapes embedded double quotes as double-double-quotes", () => {
    const chain = makeChain({
      legs: [
        {
          ...makeChain().legs[0],
          stopoffs: [
            {
              sequence: 1,
              type: "pickup",
              company_name: 'He said "hello"',
              address_1: "1 Way",
              city: "Dallas",
              state: "TX",
              zip: "75001",
              early_date_local: "2026-04-25 08:00",
              late_date_local: "2026-04-25 10:00",
              early_date_utc: null,
              late_date_utc: null,
              iana_timezone: null,
            },
          ],
        },
      ],
    });
    const csv = buildRoutesCsv([chain], "v1");
    // The JSON will have escaped quotes; when placed in a CSV cell they should be doubled
    expect(csv).toContain('""');
  });

  it("stopoffs_json round-trips via JSON.parse and includes leg_number + order_id", () => {
    const csv = buildRoutesCsv([makeChain()], "v1");
    const dataRow = csv.split("\r\n")[1];

    // Extract the last quoted field (stopoffs_json)
    const match = dataRow.match(/"((?:[^"]|"")*)"\s*$/);
    expect(match).not.toBeNull();
    const jsonStr = match![1].replace(/""/g, '"');
    const parsed = JSON.parse(jsonStr);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ leg_number: 1, order_id: "ORD-A", type: "pickup" });
    expect(parsed[1]).toMatchObject({ leg_number: 1, order_id: "ORD-A", type: "dropoff" });
  });

  it("produces empty stopoffs_json array for routes with no stopoffs", () => {
    const chain = makeChain({
      legs: [{ ...makeChain().legs[0], stopoffs: [] }],
    });
    const csv = buildRoutesCsv([chain], "v1");
    expect(csv).toContain('"[]"');
  });

  it("builds legs_summary using city,state per leg plus final destination", () => {
    const chain = makeChain({
      legs: [
        {
          ...makeChain().legs[0],
          order_id: "ORD-A",
          leg_number: 1,
          origin_city: "Dallas",
          origin_state: "TX",
          destination_city: "Atlanta",
          destination_state: "GA",
          stopoffs: [],
        },
        {
          leg_number: 2,
          order_id: "ORD-B",
          origin_city: "Atlanta",
          origin_state: "GA",
          origin_lat: 33.7,
          origin_lng: -84.4,
          destination_city: "Miami",
          destination_state: "FL",
          destination_lat: 25.8,
          destination_lng: -80.2,
          pay: 1000,
          miles: 660,
          deadhead_miles: 0,
          stopoffs: [],
        },
      ],
    });
    const csv = buildRoutesCsv([chain], "v1");
    expect(csv).toContain("Dallas,TX -> Atlanta,GA -> Miami,FL");
  });
});
