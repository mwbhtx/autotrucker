import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MonthlyNetView } from "./MonthlyNetView";
import * as api from "../api";

vi.mock("../api");
vi.mock("@/core/hooks/use-settings", () => ({
  useSettings: () => ({ data: { order_url_template: undefined } }),
}));

describe("MonthlyNetView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders earnings and fees totals", async () => {
    (api.getMonthlyNet as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      month: "2026-04",
      earned: 4436.15,
      loads_count: 2,
      fees_total: 1455,
      fees_breakdown: [{ id: "a", name: "Trailer Lease", monthly_amount: 775 }],
      net: 2981.15,
      paid_off: true,
      paid_off_amount: 1455,
      remaining_to_cover: 0,
      orders: [],
    });
    render(<MonthlyNetView />);
    // Dollar amounts render as separate "$" and numeric text nodes; use a
    // normalizer that flattens the combined text content before matching.
    // The earned amount appears in both the main card and the progress-bar
    // label, so there may be multiple matches — getAllByText is safer.
    const hasText = (needle: RegExp) =>
      screen.getAllByText((_content, node) => {
        if (!node) return false;
        const direct = Array.from(node.childNodes)
          .filter((c) => c.nodeType === 3)
          .map((c) => c.textContent ?? "")
          .join("");
        return needle.test(direct);
      });

    await waitFor(() => {
      if (hasText(/\$4436\.15/).length === 0) throw new Error("not found");
    });
    expect(hasText(/\$1455\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Trailer Lease/)).toBeInTheDocument();
  });
});
