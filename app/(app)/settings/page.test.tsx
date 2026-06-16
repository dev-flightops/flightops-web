import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  TestApiError,
  getCompanyProfile,
  listCompanyBases,
  getFlightTrackingConfig,
  listUsers,
  listSsoProviders,
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
    listUsers: vi.fn(),
    listSsoProviders: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({
  getCompanyProfile,
  listCompanyBases,
  getFlightTrackingConfig,
  listUsers,
  listSsoProviders,
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
  listUsers.mockReset();
  listSsoProviders.mockReset();
  // Default: exec_admin path — users API returns a count. Tests that
  // want the 403 path override with .mockRejectedValueOnce.
  listUsers.mockResolvedValue({ items: [], total: 5 });
  listSsoProviders.mockResolvedValue({ items: [], total: 0 });
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

  it("links Users + Permissions + SSO live; Pilot Pay stays disabled", async () => {
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

    expect(
      screen.getByRole("link", { name: /^users/i }),
    ).toHaveAttribute("href", "/settings/users");
    expect(
      screen.getByRole("link", { name: /^permissions/i }),
    ).toHaveAttribute("href", "/settings/permissions");
    expect(
      screen.getByRole("link", { name: /^sso providers/i }),
    ).toHaveAttribute("href", "/settings/sso");
    // Pilot Pay still disabled
    expect(screen.getByText("Pilot Pay").closest("[aria-disabled]"))
      .toHaveAttribute("aria-disabled", "true");
  });

  it("soft-falls back when /users is forbidden (non-exec_admin)", async () => {
    getCompanyProfile.mockResolvedValueOnce({
      id: "cp-1",
      legal_name: "Aurora",
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
    listCompanyBases.mockResolvedValueOnce({ items: [], total: 0 });
    getFlightTrackingConfig.mockResolvedValueOnce(seededTracking);
    listUsers.mockReset();
    listUsers.mockRejectedValueOnce(new TestApiError(403, "/users", "forbidden"));

    const ui = await SettingsLandingPage();
    render(ui);

    // Page still renders — no error banner, Users link still surfaces
    // with "—" sublabel rather than a count.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^users/i }),
    ).toHaveAttribute("href", "/settings/users");
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
