import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TopRoutes } from "./TopRoutes";
import { useRouteDiscoveryStore } from "../store";
import type { DiscoveredRoute } from "@/core/types";

const makeRoute = (id: string, reliability: number, stopCount: number): DiscoveredRoute => ({
  route_id: id,
  orders: Array.from({ length: stopCount }, (_, i) => ({
    origin_anchor: { lat: 30 + i, lng: -95, display_city: "City" + i, display_state: "TX" },
    destination_anchor: { lat: 31 + i, lng: -94, display_city: "City" + (i + 1), display_state: "TX" },
    matching_order_count: 50,
    rate_per_day: 1,
    reliability: 0.9,
    median_pay: 2000,
    median_rpm: 2.5,
    median_loaded_miles: 500,
    median_pre_order_deadhead_miles: 20,
  })),
  total_pay: 2000 * stopCount,
  total_loaded_miles: 500 * stopCount,
  total_deadhead_miles: 100,
  all_in_deadhead_pct: 15,
  all_in_gross_rpm: 2.8,
  composite_reliability: reliability,
  estimated_days: 2,
});

beforeEach(() => {
  useRouteDiscoveryStore.setState({ selectedRowIndex: null, activeOrderIndex: 0 });
});
afterEach(() => cleanup());

describe("TopRoutes", () => {
  it("renders a row for each route", () => {
    const routes = [makeRoute("a", 0.91, 2), makeRoute("b", 0.85, 3)];
    render(<TopRoutes routes={routes} isLoading={false} />);
    expect(screen.getAllByRole("row").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a skeleton while loading", () => {
    render(<TopRoutes routes={[]} isLoading={true} />);
    const skeletons = document.querySelectorAll("[data-testid='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders reliability as a percentage", () => {
    render(<TopRoutes routes={[makeRoute("a", 0.91, 2)]} isLoading={false} />);
    expect(screen.getByText(/91%/)).toBeInTheDocument();
  });

  it("shows stop-count badge", () => {
    render(<TopRoutes routes={[makeRoute("a", 0.91, 2)]} isLoading={false} />);
    expect(screen.getByText(/2-stop/i)).toBeInTheDocument();
  });
});
