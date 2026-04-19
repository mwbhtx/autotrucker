import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { CompanyIntegrationView } from "./CompanyIntegrationView";
import * as api from "../api";

vi.mock("../api");

describe("CompanyIntegrationView", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows disconnected state when not configured", async () => {
    (
      api.getCompanyIntegration as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ configured: false, company_username: null });
    render(<CompanyIntegrationView />);
    await waitFor(() =>
      screen.getByText(/Connect your Mercer account to enable automatic load sync/i),
    );
  });

  it("shows connected state with username", async () => {
    (
      api.getCompanyIntegration as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      configured: true,
      company_username: "john.doe",
    });
    render(<CompanyIntegrationView />);
    await waitFor(() => screen.getByText(/Connected as/i));
    expect(screen.getByText("john.doe")).toBeInTheDocument();
  });

  it("never displays password field content", async () => {
    (
      api.getCompanyIntegration as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      configured: true,
      company_username: "john.doe",
    });
    render(<CompanyIntegrationView />);
    await waitFor(() => screen.getByText(/Connected as/i));
    fireEvent.click(screen.getByText(/Change Credentials/i));
    const passwordInput = screen.getByLabelText(
      /Company Password/i,
    ) as HTMLInputElement;
    expect(passwordInput.value).toBe("");
    expect(passwordInput.type).toBe("password");
  });
});
