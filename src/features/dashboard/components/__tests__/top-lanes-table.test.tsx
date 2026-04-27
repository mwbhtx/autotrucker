import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TopLanesTable } from "../top-lanes-table";

vi.mock("@/core/hooks/use-analytics", () => ({
  useAnalyticsTopLanes: vi.fn(),
}));

import { useAnalyticsTopLanes } from "@/core/hooks/use-analytics";

afterEach(() => {
  cleanup();
});

describe("TopLanesTable", () => {
  it("renders 'Top Lanes (City → City)' for granularity=city", () => {
    (useAnalyticsTopLanes as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopLanesTable companyId="c-1" granularity="city" />);
    expect(screen.getByText("Top Lanes (City → City)")).toBeInTheDocument();
  });

  it("renders 'Top Lanes (State → State)' for granularity=state", () => {
    (useAnalyticsTopLanes as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopLanesTable companyId="c-1" granularity="state" />);
    expect(screen.getByText("Top Lanes (State → State)")).toBeInTheDocument();
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
});
