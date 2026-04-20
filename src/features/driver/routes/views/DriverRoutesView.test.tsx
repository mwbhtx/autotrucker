// src/features/driver/routes/views/DriverRoutesView.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { DriverRoutesView } from "./DriverRoutesView";
import * as routesApi from "../api";
import * as assignedApi from "@/features/driver/assigned-orders/api";

vi.mock("../api");
vi.mock("@/features/driver/assigned-orders/api");

describe("DriverRoutesView", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows empty state and Add Route button when no routes", async () => {
    (routesApi.listDriverRoutes as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ routes: [] });
    render(<DriverRoutesView />);
    await waitFor(() => screen.getByText(/no routes yet/i));
    expect(screen.getByRole("button", { name: /add route/i })).toBeTruthy();
  });

  it("renders route cards when routes exist", async () => {
    (routesApi.listDriverRoutes as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      routes: [
        {
          id: "r1",
          order_ids: ["E1", "E2"],
          created_at: "2026-04-19T00:00:00Z",
          origin: { city: "Houston", state: "TX" },
          destination: { city: "Chicago", state: "IL" },
          earliest_pickup_date: "2026-04-02",
          latest_pickup_date: "2026-04-05",
          days_driven: null,
  segments: [],
          summary: { total_pay: 2500, total_miles: 1200, effective_rpm: 2.08, profit: 400 },
        },
      ],
    });
    render(<DriverRoutesView />);
    await waitFor(() => screen.getByText(/Houston, TX/));
    expect(screen.getByText(/Chicago, IL/)).toBeTruthy();
  });
});
