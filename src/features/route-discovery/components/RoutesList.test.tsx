import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RoutesList } from "./RoutesList";
import { useRouteDiscoveryStore } from "../store";
import type { DiscoveredRoute } from "@/core/types";

const makeRoute = (id: string): DiscoveredRoute => ({
  route_id: id,
  orders: [
    {
      origin_anchor: { lat: 30, lng: -95, display_city: "Houston", display_state: "TX" },
      destination_anchor: { lat: 35, lng: -90, display_city: "Memphis", display_state: "TN" },
      matching_order_count: 100,
      rate_per_day: 1,
      reliability: 0.8,
      median_pay: 2000,
      median_rpm: 2.5,
      median_loaded_miles: 500,
      median_pre_order_deadhead_miles: 0,
    },
  ],
  total_pay: 2000,
  total_loaded_miles: 500,
  total_deadhead_miles: 0,
  all_in_deadhead_pct: 0,
  all_in_gross_rpm: 4,
  composite_reliability: 0.8,
  estimated_days: 1,
});

describe("RoutesList", () => {
  beforeEach(() => {
    useRouteDiscoveryStore.setState({ selectedRowIndex: null, activeOrderIndex: 0 });
  });
  afterEach(() => cleanup());

  it("renders one button per route", () => {
    const routes = [makeRoute("a"), makeRoute("b"), makeRoute("c")];
    render(<RoutesList routes={routes} />);
    expect(screen.getAllByRole("button").length).toBe(3);
  });

  it("auto-selects index 0 when routes load", () => {
    const routes = [makeRoute("a"), makeRoute("b")];
    render(<RoutesList routes={routes} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-current", "true");
    expect(buttons[1]).not.toHaveAttribute("aria-current");
  });

  it("ArrowDown moves selection forward", () => {
    const routes = [makeRoute("a"), makeRoute("b"), makeRoute("c")];
    const { container } = render(<RoutesList routes={routes} />);
    // After auto-select, current is 0
    const list = container.querySelector("ul")!;
    fireEvent.keyDown(list, { key: "ArrowDown" });
    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).toHaveAttribute("aria-current", "true");
  });
});
