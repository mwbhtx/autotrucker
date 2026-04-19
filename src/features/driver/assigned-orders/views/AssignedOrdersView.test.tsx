import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { AssignedOrdersView } from "./AssignedOrdersView";
import * as api from "../api";

vi.mock("../api");

function listResponse(orders: unknown[]) {
  return {
    orders,
    count: orders.length,
    next_sync_available_at: null,
    active_sync_task: null,
  };
}

describe("AssignedOrdersView", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows empty state when no orders", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      listResponse([]),
    );
    render(<AssignedOrdersView />);
    await waitFor(() => screen.getByText(/No orders\.?$/i));
  });

  it("renders summary and table when orders exist", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      listResponse([
        {
          order_id: "E1",
          status: "settled",
          ingested_at: "t",
          has_order_details: true,
          pickup_date: "2026-04-15",
          pay: 1000,
          loaded_miles: 500,
          rate_per_mile: 2,
        },
        {
          order_id: "E2",
          status: "settled",
          ingested_at: "t",
          has_order_details: true,
          pickup_date: "2026-04-17",
          pay: 2000,
          loaded_miles: 800,
          rate_per_mile: 2.5,
        },
      ]),
    );
    render(<AssignedOrdersView />);
    await waitFor(() => screen.getByText("E1"));
    expect(screen.getByText(/\$3000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/1300/)).toBeInTheDocument();
  });

  it("filters to settled rows when 'Settled' filter selected", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      listResponse([
        {
          order_id: "E1",
          status: "settled",
          ingested_at: "t",
          has_order_details: true,
          pay: 1000,
          loaded_miles: 500,
        },
        {
          order_id: "E2",
          status: "dispatched",
          ingested_at: "t",
          has_order_details: false,
        },
      ]),
    );
    render(<AssignedOrdersView />);
    await waitFor(() => screen.getByText("E1"));
    fireEvent.click(screen.getByRole("button", { name: "Settled" }));
    expect(screen.getByText("E1")).toBeInTheDocument();
    expect(screen.queryByText("E2")).not.toBeInTheDocument();
  });

  it("filters to dispatched rows when 'Dispatched' filter selected", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      listResponse([
        {
          order_id: "E1",
          status: "settled",
          ingested_at: "t",
          has_order_details: true,
          pay: 1000,
          loaded_miles: 500,
        },
        {
          order_id: "E2",
          status: "dispatched",
          ingested_at: "t",
          has_order_details: false,
        },
      ]),
    );
    render(<AssignedOrdersView />);
    await waitFor(() => screen.getByText("E1"));
    fireEvent.click(screen.getByRole("button", { name: "Dispatched" }));
    expect(screen.queryByText("E1")).not.toBeInTheDocument();
    expect(screen.getByText("E2")).toBeInTheDocument();
  });

  it("renders stub Sync button on unlinked rows", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      listResponse([
        {
          order_id: "E2",
          status: "dispatched",
          ingested_at: "t",
          has_order_details: false,
        },
      ]),
    );
    render(<AssignedOrdersView />);
    await waitFor(() => screen.getByText("E2"));
    // Per-row stub button on unlinked rows — matched by exact aria-label
    const stub = screen.getByRole("button", { name: "Sync order" });
    expect(stub).toBeDisabled();
  });

  it("renders the Sync Orders button", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      listResponse([]),
    );
    render(<AssignedOrdersView />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sync orders/i }),
      ).toBeInTheDocument(),
    );
  });
});
