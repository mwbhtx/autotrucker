// src/features/driver/routes/components/RouteCard.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RouteCard } from "./RouteCard";
import type { DriverRouteSummary } from "../types";

afterEach(() => cleanup());

const summary: DriverRouteSummary = {
  id: "r1",
  order_ids: ["E1", "E2"],
  created_at: "2026-04-19T00:00:00Z",
  origin: { city: "Houston", state: "TX" },
  destination: { city: "Chicago", state: "IL" },
  earliest_pickup_date: "2026-04-02",
  latest_pickup_date: "2026-04-05",
  days_driven: null,
  summary: { total_pay: 2500, total_miles: 1200, effective_rpm: 2.08, profit: 400 },
};

describe("RouteCard", () => {
  it("renders origin → destination and key metrics", () => {
    render(<RouteCard route={summary} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/Houston, TX/)).toBeTruthy();
    expect(screen.getByText(/Chicago, IL/)).toBeTruthy();
    expect(screen.getByText(/\$2,500/)).toBeTruthy();
    expect(screen.getByText(/1,200/)).toBeTruthy();
  });

  it("calls onOpen when card body is clicked", () => {
    const onOpen = vi.fn();
    render(<RouteCard route={summary} onOpen={onOpen} onDelete={() => {}} />);
    fireEvent.click(screen.getByTestId("route-card-body"));
    expect(onOpen).toHaveBeenCalledWith("r1");
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = vi.fn();
    render(<RouteCard route={summary} onOpen={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText(/delete route/i));
    expect(onDelete).toHaveBeenCalledWith("r1");
  });

  it("shows 'Analysis unavailable' when summary is null", () => {
    render(
      <RouteCard
        route={{ ...summary, summary: null }}
        onOpen={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText(/Analysis unavailable/i)).toBeTruthy();
  });
});
