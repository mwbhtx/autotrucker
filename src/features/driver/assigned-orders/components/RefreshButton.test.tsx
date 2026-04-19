import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { RefreshButton } from "./RefreshButton";
import * as api from "../api";

vi.mock("../api");

describe("RefreshButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it("shows Refresh label by default", () => {
    render(<RefreshButton onRefreshed={() => {}} />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("posts to refresh and enters the Syncing state", async () => {
    (api.refreshAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      queued: true,
    });
    render(<RefreshButton onRefreshed={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() =>
      expect(api.refreshAssignedOrders).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByRole("button", { name: "Syncing…" })).toBeDisabled();
  });

  it("renders a rate-limit message when refresh returns 429", async () => {
    (api.refreshAssignedOrders as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("HTTP 429: rate limited"),
    );
    render(<RefreshButton onRefreshed={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/rate limited/i),
    );
    expect(screen.getByRole("button", { name: "Syncing…" })).toBeDisabled();
  });
});
