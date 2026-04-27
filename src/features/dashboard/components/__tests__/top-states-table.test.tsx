import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TopStatesTable } from "../top-states-table";

vi.mock("@/core/hooks/use-analytics", () => ({
  useAnalyticsTopStates: vi.fn(),
}));

import { useAnalyticsTopStates } from "@/core/hooks/use-analytics";

afterEach(() => {
  cleanup();
  (useAnalyticsTopStates as unknown as { mockClear: () => void }).mockClear();
});

describe("TopStatesTable", () => {
  it("renders 'Top Export States' for side=origin", () => {
    (useAnalyticsTopStates as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopStatesTable companyId="c-1" side="origin" />);
    expect(screen.getByText("Top Export States")).toBeInTheDocument();
    expect(screen.getByText("Outbound Diversity")).toBeInTheDocument();
  });

  it("renders 'Top Import States' for side=destination", () => {
    (useAnalyticsTopStates as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopStatesTable companyId="c-1" side="destination" />);
    expect(screen.getByText("Top Import States")).toBeInTheDocument();
    expect(screen.getByText("Inbound Diversity")).toBeInTheDocument();
  });

  it("renders rows with state-level fields", () => {
    (useAnalyticsTopStates as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [
        { state: "TX", load_count: 50, loads_per_day: 7.1, median_rate_per_mile: 2.18, entropy_h: 3.11 },
      ],
      isLoading: false,
      isError: false,
    });
    render(<TopStatesTable companyId="c-1" side="origin" />);
    expect(screen.getByText("TX")).toBeInTheDocument();
    expect(screen.getByText("7.1")).toBeInTheDocument();
    expect(screen.getByText("$2.18")).toBeInTheDocument();
    expect(screen.getByText("3.11")).toBeInTheDocument();
  });

  it("renders 'No data available' when array is empty", () => {
    (useAnalyticsTopStates as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopStatesTable companyId="c-1" side="destination" />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("clicking $/mi header re-ranks rows by median_rate_per_mile DESC client-side", () => {
    (useAnalyticsTopStates as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [
        {
          state: "HV",
          load_count: 100,
          loads_per_day: 10,
          median_rate_per_mile: 2.0,
          entropy_h: 2.5,
        },
        {
          state: "HR",
          load_count: 50,
          loads_per_day: 5,
          median_rate_per_mile: 3.5,
          entropy_h: 1.0,
        },
      ],
      isLoading: false,
      isError: false,
    });
    render(<TopStatesTable companyId="c-1" side="origin" />);

    // Default sort is loads_per_day DESC, so HV (state) should be first
    let rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("HV");
    expect(rows[2]).toHaveTextContent("HR");

    fireEvent.click(screen.getByText("$/mi"));

    rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("HR");
    expect(rows[2]).toHaveTextContent("HV");

    // Hook signature is now (companyId, side, from, to) — no sort arg
    const calls = (useAnalyticsTopStates as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    for (const call of calls) {
      expect(call.length).toBeLessThanOrEqual(4);
    }
  });
});
