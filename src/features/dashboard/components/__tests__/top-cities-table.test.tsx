import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TopCitiesTable } from "../top-cities-table";

vi.mock("@/core/hooks/use-analytics", () => ({
  useAnalyticsTopCities: vi.fn(),
}));

import { useAnalyticsTopCities } from "@/core/hooks/use-analytics";

describe("TopCitiesTable", () => {
  afterEach(() => {
    cleanup();
  });


  it("renders 'Top Origin Cities' for side=origin", () => {
    (useAnalyticsTopCities as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopCitiesTable companyId="c-1" side="origin" />);
    expect(screen.getByText("Top Origin Cities")).toBeInTheDocument();
  });

  it("renders 'Top Destination Cities' for side=destination and 'Inbound Diversity' header", () => {
    (useAnalyticsTopCities as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopCitiesTable companyId="c-1" side="destination" />);
    expect(screen.getByText("Top Destination Cities")).toBeInTheDocument();
    expect(screen.getByText("Inbound Diversity")).toBeInTheDocument();
  });

  it("formats numeric columns: loads/day to 1 dp, $/mi to currency 2 dp, entropy_h to 2 dp; renders em-dash for null median", () => {
    (useAnalyticsTopCities as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [
        {
          city: "Memphis",
          state: "TN",
          load_count: 12,
          loads_per_day: 12.4,
          median_rate_per_mile: 2.41,
          entropy_h: 2.84,
        },
        {
          city: "NoRate",
          state: "TX",
          load_count: 1,
          loads_per_day: 0.4,
          median_rate_per_mile: null,
          entropy_h: 0,
        },
      ],
      isLoading: false,
      isError: false,
    });
    render(<TopCitiesTable companyId="c-1" side="origin" />);
    expect(screen.getByText("Memphis, TN")).toBeInTheDocument();
    expect(screen.getByText("12.4")).toBeInTheDocument();
    expect(screen.getByText("$2.41")).toBeInTheDocument();
    expect(screen.getByText("2.84")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument(); // null median_rate_per_mile
  });

  it("renders 'No data available' when array is empty and not loading", () => {
    (useAnalyticsTopCities as unknown as { mockReturnValue: Function }).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
    render(<TopCitiesTable companyId="c-1" side="origin" />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
