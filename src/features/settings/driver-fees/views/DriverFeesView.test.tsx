import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DriverFeesView } from "./DriverFeesView";
import * as api from "../api";

vi.mock("../api");

describe("DriverFeesView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows empty state when no fees exist", async () => {
    (api.listDriverFees as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<DriverFeesView />);
    await waitFor(() => screen.getByText(/No fees configured yet/i));
  });

  it("renders fee rows and total", async () => {
    (api.listDriverFees as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "a",
        name: "Trailer Lease",
        monthly_amount: 775,
        active: true,
        user_id: "u",
        company_id: "c",
        created_at: "",
        updated_at: "",
      },
      {
        id: "b",
        name: "ELD",
        monthly_amount: 39,
        active: true,
        user_id: "u",
        company_id: "c",
        created_at: "",
        updated_at: "",
      },
    ]);
    render(<DriverFeesView />);
    await waitFor(() => screen.getByText("Trailer Lease"));
    expect(screen.getByText("$775.00")).toBeInTheDocument();
    expect(screen.getByText(/\$814\.00/)).toBeInTheDocument();
  });
});
