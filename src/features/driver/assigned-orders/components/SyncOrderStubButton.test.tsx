import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SyncOrderStubButton } from "./SyncOrderStubButton";

describe("SyncOrderStubButton", () => {
  afterEach(() => cleanup());

  it("renders disabled with a tooltip title", () => {
    render(<SyncOrderStubButton orderId="E1" />);
    const btn = screen.getByRole("button", { name: /sync/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Sync Order — coming soon.");
    expect(btn).toHaveAttribute("data-order-id", "E1");
  });
});
