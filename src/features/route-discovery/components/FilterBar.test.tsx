import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  afterEach(() => cleanup());

  it("renders all four inputs and a Search button", () => {
    render(<FilterBar onSearch={vi.fn()} />);
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/radius/i)).toBeInTheDocument();
    expect(screen.getByText(/orders/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument();
  });

  it("disables Search until all required fields are filled", () => {
    render(<FilterBar onSearch={vi.fn()} />);
    const button = screen.getByRole("button", { name: /search/i });
    expect(button).toBeDisabled();
  });

  it("emits onSearch with the form values", () => {
    const onSearch = vi.fn();
    render(<FilterBar onSearch={onSearch} />);
    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: "Houston" } });
    // Use the native select element via getByLabelText
    fireEvent.change(screen.getByLabelText(/state/i), { target: { value: "TX" } });
    fireEvent.change(screen.getByLabelText(/radius/i), { target: { value: "100" } });
    // For Orders the test depends on how you implement the toggle. Default is 3,
    // so just clicking Search should emit order_count: 3.
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(onSearch).toHaveBeenCalledWith({
      city: "Houston",
      state: "TX",
      radius_miles: 100,
      order_count: 3,
    });
  });
});
