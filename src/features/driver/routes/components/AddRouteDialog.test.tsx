// src/features/driver/routes/components/AddRouteDialog.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AddRouteDialog } from "./AddRouteDialog";
import * as api from "@/features/driver/assigned-orders/api";

vi.mock("@/features/driver/assigned-orders/api");

function makeOrder(order_id: string, overrides: Record<string, unknown> = {}) {
  return {
    order_id,
    status: "settled" as const,
    ingested_at: "2026-04-19T00:00:00Z",
    has_order_details: true,
    pickup_date: "2026-04-05",
    origin_city: "Houston",
    origin_state: "TX",
    destination_city: "Dallas",
    destination_state: "TX",
    pay: 1500,
    loaded_miles: 400,
    rate_per_mile: 3.75,
    ...overrides,
  };
}

describe("AddRouteDialog", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("lists only settled orders with details", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      orders: [
        makeOrder("E1"),
        makeOrder("E2", { status: "dispatched" }),
        makeOrder("E3", { has_order_details: false }),
        makeOrder("E4"),
      ],
      count: 4,
      next_sync_available_at: null,
      active_sync_task: null,
    });
    render(<AddRouteDialog open onClose={() => {}} onCreated={() => Promise.resolve()} />);
    await waitFor(() => expect(screen.getByText("E1")).toBeTruthy());
    expect(screen.queryByText("E2")).toBeNull();
    expect(screen.queryByText("E3")).toBeNull();
    expect(screen.getByText("E4")).toBeTruthy();
  });

  it("enables Save only when exactly 2 are selected; Save calls onCreated", async () => {
    (api.listAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      orders: [makeOrder("E1"), makeOrder("E4")],
      count: 2,
      next_sync_available_at: null,
      active_sync_task: null,
    });
    const onCreated = vi.fn().mockResolvedValue(undefined);
    render(<AddRouteDialog open onClose={() => {}} onCreated={onCreated} />);

    await waitFor(() => screen.getByText("E1"));
    const save = screen.getByRole("button", { name: /save/i });
    expect(save.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByLabelText("Select E1"));
    expect(save.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByLabelText("Select E4"));
    expect(save.hasAttribute("disabled")).toBe(false);

    fireEvent.click(save);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(["E1", "E4"]));
  });
});
