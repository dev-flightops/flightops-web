import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompanyBaseResponse } from "@/lib/api/types";

const { TestApiError, listCompanyBases } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listCompanyBases: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ listCompanyBases }));
vi.mock("@/components/settings/add-base-dialog", () => ({
  AddBaseDialog: () => <div data-testid="add-base-dialog" />,
}));
vi.mock("@/components/settings/edit-base-dialog", () => ({
  EditBaseDialog: ({ base }: { base: CompanyBaseResponse }) => (
    <div data-testid={`edit-${base.icao}`} />
  ),
}));
vi.mock("@/components/settings/deactivate-base-button", () => ({
  DeactivateBaseButton: ({ icao }: { icao: string }) => (
    <div data-testid={`deactivate-${icao}`} />
  ),
}));

import SettingsBasesPage from "./page";

function makeBase(overrides: Partial<CompanyBaseResponse>): CompanyBaseResponse {
  return {
    id: "b-1",
    icao: "PANC",
    display_name: "Anchorage",
    city: "Anchorage",
    state: "AK",
    timezone: "America/Anchorage",
    is_hub: false,
    is_active: true,
    manager_name: null,
    manager_phone: null,
    manager_email: null,
    notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  listCompanyBases.mockReset();
});

async function renderPage(searchParams: { active_only?: string } = {}) {
  const ui = await SettingsBasesPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("SettingsBasesPage (M2-G-47)", () => {
  it("renders the active table and inactive section separately", async () => {
    listCompanyBases.mockResolvedValueOnce({
      items: [
        makeBase({ id: "b-1", icao: "PANC", is_hub: true }),
        makeBase({ id: "b-2", icao: "PAJN", display_name: "Juneau" }),
        makeBase({
          id: "b-3",
          icao: "PAAQ",
          display_name: "Palmer",
          is_active: false,
        }),
      ],
      total: 3,
    });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /^bases$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("PANC")).toBeInTheDocument();
    expect(screen.getByText("PAJN")).toBeInTheDocument();
    expect(screen.getByText(/inactive \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("PAAQ")).toBeInTheDocument();
    expect(screen.getByText("Hub")).toBeInTheDocument();
  });

  it("renders the empty state when no bases exist", async () => {
    listCompanyBases.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/no bases yet/i)).toBeInTheDocument();
  });

  it("filters to active when ?active_only=true is set", async () => {
    listCompanyBases.mockResolvedValueOnce({
      items: [makeBase({ id: "b-1" })],
      total: 1,
    });

    await renderPage({ active_only: "true" });

    expect(listCompanyBases).toHaveBeenCalledWith({ includeInactive: false });
  });

  it("renders an error banner when the API call fails", async () => {
    listCompanyBases.mockRejectedValueOnce(
      new TestApiError(500, "/x", "boom"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });
});
