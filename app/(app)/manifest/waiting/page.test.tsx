import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listWaiting: vi.fn(), loadZoneTable: vi.fn() };
});
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("@/lib/api/client", () => ({ ApiError: mocks.TestApiError, apiFetch: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: mocks.loadZoneTable }));
vi.mock("@/lib/api/manifest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/manifest")>()),
  listWaiting: mocks.listWaiting,
}));
vi.mock("./actions", () => ({ createWaitingAction: vi.fn(), cancelWaitingAction: vi.fn() }));

import WaitingMailFreightPage from "./page";

function row(over: Record<string, unknown>) {
  return {
    id: "w-1",
    station_icao: "PABE",
    destination_icao: "PAHP",
    mail_class: "bypass_mail",
    description: "USPS Bypass Mail",
    weight_lbs: "2000.0",
    pieces: 40,
    shipper: null,
    consignee: null,
    notes: null,
    status: "waiting",
    received_at: "2026-10-20T16:00:00Z",
    ...over,
  };
}

const ITEMS = [
  row({}),
  row({ id: "w-2", mail_class: null, description: "Generator", weight_lbs: "300.0", pieces: 1, shipper: "Bethel Supply", consignee: "Village Clinic", notes: "Keep upright" }),
  row({ id: "w-3", station_icao: "PHTO", destination_icao: "PHNL", mail_class: "priority_mail", description: "USPS Priority Mail", weight_lbs: "150.0", pieces: 3 }),
];
const ROUTES = [
  { station_icao: "PABE", destination_icao: "PAHP", entries: 2, weight_lbs: "2300.0", pieces: 41 },
  { station_icao: "PHTO", destination_icao: "PHNL", entries: 1, weight_lbs: "150.0", pieces: 3 },
];

async function renderPage(station?: string) {
  render(await WaitingMailFreightPage({ searchParams: Promise.resolve({ station }) }));
}

beforeEach(() => {
  mocks.listWaiting.mockReset().mockResolvedValue({ items: ITEMS, routes: ROUTES });
  mocks.loadZoneTable
    .mockReset()
    .mockResolvedValue({ byIcao: { PABE: "America/Anchorage", PHTO: "Pacific/Honolulu" }, fallback: "America/Anchorage" });
});

describe("/manifest/waiting (#75)", () => {
  it("groups what is waiting by route, with each route's totals", async () => {
    await renderPage();
    const bethel = within(screen.getByRole("region", { name: "PABE → PAHP" }));
    expect(bethel.getByText("2 entries · 2,300 lb · 41 pieces")).toBeTruthy();
    expect(bethel.getByText("2,000 lb")).toBeTruthy();
    expect(bethel.getByText("Bethel Supply → Village Clinic")).toBeTruthy();
    expect(bethel.getByText("Keep upright")).toBeTruthy();
    expect(bethel.getByRole("button", { name: "Remove Generator from waiting" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "PHTO → PHNL" })).getByText("1 entry · 150 lb · 3 pieces")).toBeTruthy();
  });

  it("shows when each entry came in, in its station's zone", async () => {
    await renderPage();
    expect(within(screen.getByRole("region", { name: "PABE → PAHP" })).getAllByText("Oct 20, 08:00 AKDT")).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "PHTO → PHNL" })).getByText("Oct 20, 06:00 HST")).toBeTruthy();
  });

  it("shows one station when asked, and a bad code shows them all", async () => {
    await renderPage("pabe");
    expect(mocks.listWaiting).toHaveBeenLastCalledWith({ station: "PABE" });
    expect(screen.getByText(/At PABE only/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "show every station" }).getAttribute("href")).toBe("/manifest/waiting");
    expect((screen.getByRole("textbox", { name: "At station" }) as HTMLInputElement).value).toBe("PABE");

    document.body.innerHTML = "";
    await renderPage("../x");
    expect(mocks.listWaiting).toHaveBeenLastCalledWith({ station: undefined });
  });

  it("says when nothing is waiting", async () => {
    mocks.listWaiting.mockResolvedValue({ items: [], routes: [] });
    await renderPage();
    expect(screen.getByText("Nothing is waiting.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Log mail or freight" })).toBeTruthy();
  });

  it("says when the list can't be had", async () => {
    mocks.listWaiting.mockRejectedValue(new mocks.TestApiError(401, "/manifest/waiting", "expired"));
    await renderPage();
    expect(screen.getByRole("alert").textContent).toBe("Your session expired. Sign in again.");
  });
});
