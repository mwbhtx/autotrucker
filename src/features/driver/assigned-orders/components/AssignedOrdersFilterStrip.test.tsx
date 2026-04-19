import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AssignedOrdersFilterStrip } from "./AssignedOrdersFilterStrip";

describe("AssignedOrdersFilterStrip", () => {
  afterEach(() => cleanup());

  it("renders the three filter options", () => {
    render(<AssignedOrdersFilterStrip value="all" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dispatched" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settled" })).toBeInTheDocument();
  });

  it("calls onChange with the clicked option", () => {
    const onChange = vi.fn();
    render(<AssignedOrdersFilterStrip value="all" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Settled" }));
    expect(onChange).toHaveBeenCalledWith("settled");
  });

  it("marks the current selection with default variant", () => {
    render(<AssignedOrdersFilterStrip value="dispatched" onChange={() => {}} />);
    const dispatched = screen.getByRole("button", { name: "Dispatched" });
    const all = screen.getByRole("button", { name: "All" });
    expect(dispatched).toHaveAttribute("data-variant", "default");
    expect(all).toHaveAttribute("data-variant", "outline");
  });
});
