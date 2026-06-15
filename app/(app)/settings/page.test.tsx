import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  TestApiError,
  getCompanyProfile,
  listCompanyBases,
  getFlightTrackingConfig,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    getCompanyProfile: vi.fn(),
    listCompanyBases: vi.fn(),
    getFlightTrackingConfig: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({
  getCompanyProfile,
  listCompanyBases,
  getFlightTrackingConfig,
}));

import SettingsLandingPage from "./page";

const seededTracking = {
  id: "ft-1",
  overdue_threshold_minutes: 20,
  position_polling_seconds: 30,
  simulation_mode_enabled: true,
  spider_tracks_aff_email: null,
  spider_tracks_aff_endpoint: null,
};

beforeEach(() => {
  getCompanyProfile.mockReset();
  listCompanyBases.mockReset();
  getFlightTrackingConfig.mockReset();
});

describe("SettingsLandingPage (M2-G-46)", () => {
  it("renders the four stat tiles + section cards", async () => {
    getCompanyProfile.mockResolvedValueOnce({
      id: "cp-1",
      legal_name: "Aurora Air LLC",
      short_name: "Aurora",
      logo_url: null,
      street_line_1: null,
      street_line_2: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      main_phone: null,
      ops_phone: null,
      main_email: null,
      ops_email: null,
      part_135_certificate: null,
      fiscal_year_end: null,
      notes: null,
    });
    listCompanyBases.mockResolvedValueOnce({
      items: [],
      total: 3,
    });
    getFlightTrackingConfig.mockResolvedValueOnce(seededTracking);

    const ui = await SettingsLandingPage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: /^settings$/i, level: 1 }),
    ).toBeInTheDocument();
    // Short name renders in both the stat tile and the Company card sublabel
    expect(screen.getAllByText("Aurora").length).toBeGreaterThan(0);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("20 min")).toBeInTheDocument();
    expect(screen.getByText("Simulation")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /company profile/i }),
    ).toHaveAttribute("href", "/settings/company");
    expect(
      screen.getByRole("link", { name: /manage bases/i }),
    ).toHaveAttribute("href", "/settings/bases");
    expect(
      screen.getByRole("link", { name: /tracking config/i }),
    ).toHaveAttribute("href", "/settings/flight-tracking");
  });

  it("renders disabled chips for M2-next + M3 features", async () => {
    getCompanyProfile.mockResolvedValueOnce({
      id: "cp-1",
      legal_name: null,
      short_name: null,
      logo_url: null,
      street_line_1: null,
      street_line_2: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      main_phone: null,
      ops_phone: null,
      main_email: null,
      ops_email: null,
      part_135_certificate: null,
      fiscal_year_end: null,
      notes: null,
    });
    listCompanyBases.mockResolvedValueOnce({ items: [], total: 0 });
    getFlightTrackingConfig.mockResolvedValueOnce(seededTracking);

    const ui = await SettingsLandingPage();
    render(ui);

    // Disabled chips for users / SSO / pilot pay
    expect(screen.getByText("Users").closest("[aria-disabled]"))
      .toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("SSO").closest("[aria-disabled]"))
      .toHaveAttribute("aria-disabled", "true");
  });

  it("shows a banner when the API call fails", async () => {
    getCompanyProfile.mockRejectedValueOnce(new TestApiError(500, "/x", "x"));
    listCompanyBases.mockResolvedValueOnce({ items: [], total: 0 });
    getFlightTrackingConfig.mockResolvedValueOnce(seededTracking);

    const ui = await SettingsLandingPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("shows session-expired text on 401", async () => {
    getCompanyProfile.mockRejectedValueOnce(
      new TestApiError(401, "/x", "expired"),
    );
    listCompanyBases.mockResolvedValueOnce({ items: [], total: 0 });
    getFlightTrackingConfig.mockResolvedValueOnce(seededTracking);

    const ui = await SettingsLandingPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });
});
