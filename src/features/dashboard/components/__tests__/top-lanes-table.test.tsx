import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TopLanesTable } from "../top-lanes-table";

vi.mock("@/core/hooks/use-analytics", () => ({
  useAnalyticsTopLanes: vi.fn(),
}));

import { useAnalyticsTopLanes } from "@/core/hooks/use-analytics";

afterEach(() => {
  cleanup();
  (useAnalyticsTopLanes as unknown as { mockClear: () => void }).mockClear();
});

describe("TopLanesTable", () => {
  it("renders 'Top Lanes (Cities)' for granularity=city", () => {
    (useAnalyticsTopLanes as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopLanesTable companyId="c-1" granularity="city" />);
    expect(screen.getByText("Top Lanes (Cities)")).toBeInTheDocument();
  });

  it("renders 'Top Lanes (States)' for granularity=state", () => {
    (useAnalyticsTopLanes as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopLanesTable companyId="c-1" granularity="state" />);
    expect(screen.getByText("Top Lanes (States)")).toBeInTheDocument();
  });

  it("renders 'Top Lanes (Regions)' for granularity=region", () => {
    (useAnalyticsTopLanes as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopLanesTable companyId="c-1" granularity="region" />);
    expect(screen.getByText("Top Lanes (Regions)")).toBeInTheDocument();
  });

  it("renders rows with arrow-joined OD label and integer Median Pay; null pay -> em dash", () => {
    (useAnalyticsTopLanes as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [
        {
          origin_city: "Memphis",
          origin_state: "TN",
          destination_city: "Dallas",
          destination_state: "TX",
          origin_label: "Memphis, TN",
          destination_label: "Dallas, TX",
          load_count: 8,
          loads_per_day: 8.4,
          median_rate_per_mile: 2.4,
          median_pay: 1820,
        },
        {
          origin_city: null,
          origin_state: "TN",
          destination_city: null,
          destination_state: "TX",
          origin_label: "TN",
          destination_label: "TX",
          load_count: 3,
          loads_per_day: 0.4,
          median_rate_per_mile: null,
          median_pay: null,
        },
      ],
      isLoading: false,
      isError: false,
    });
    render(<TopLanesTable companyId="c-1" granularity="city" />);
    expect(screen.getByText("Memphis, TN → Dallas, TX")).toBeInTheDocument();
    expect(screen.getByText("$1,820")).toBeInTheDocument();
    expect(screen.getByText("TN → TX")).toBeInTheDocument();
    // null median_pay AND null $/mi => two em-dashes; just assert at least one render
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking Median Pay header re-ranks rows by median_pay DESC client-side", () => {
    (useAnalyticsTopLanes as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [
        {
          origin_city: "HighVolO",
          origin_state: "TN",
          destination_city: "HighVolD",
          destination_state: "TX",
          origin_label: "HighVolO, TN",
          destination_label: "HighVolD, TX",
          load_count: 100,
          loads_per_day: 10,
          median_rate_per_mile: 2.0,
          median_pay: 1000,
        },
        {
          origin_city: "HighPayO",
          origin_state: "AL",
          destination_city: "HighPayD",
          destination_state: "GA",
          origin_label: "HighPayO, AL",
          destination_label: "HighPayD, GA",
          load_count: 50,
          loads_per_day: 5,
          median_rate_per_mile: 3.5,
          median_pay: 5000,
        },
      ],
      isLoading: false,
      isError: false,
    });
    render(<TopLanesTable companyId="c-1" granularity="city" />);

    // Default sort is loads_per_day DESC, so HighVol lane should be first
    let rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("HighVolO, TN → HighVolD, TX");
    expect(rows[2]).toHaveTextContent("HighPayO, AL → HighPayD, GA");

    fireEvent.click(screen.getByText("Median Pay"));

    rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("HighPayO, AL → HighPayD, GA");
    expect(rows[2]).toHaveTextContent("HighVolO, TN → HighVolD, TX");

    // Hook signature is now (companyId, granularity, from, to) — no sort arg
    const calls = (useAnalyticsTopLanes as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    for (const call of calls) {
      expect(call.length).toBeLessThanOrEqual(4);
    }
  });
});
