import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AssignedOrdersView } from "./AssignedOrdersView";
import * as api from "../api";

vi.mock("../api");

describe("AssignedOrdersView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty state when no orders", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<AssignedOrdersView />);
    await waitFor(() => screen.getByText(/No orders in range/i));
  });

  it("renders summary and table when orders exist", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        carrier_order_id: "E1",
        pickup_date: "2026-04-15",
        truck_pay: 1000,
        loaded_miles: 500,
        rate_per_mile: 2,
        source: "mercer",
      },
      {
        carrier_order_id: "E2",
        pickup_date: "2026-04-17",
        truck_pay: 2000,
        loaded_miles: 800,
        rate_per_mile: 2.5,
        source: "mercer",
      },
    ]);
    render(<AssignedOrdersView />);
    await waitFor(() => screen.getByText("E1"));
    expect(screen.getByText(/\$3000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/1300/)).toBeInTheDocument();
  });
});
