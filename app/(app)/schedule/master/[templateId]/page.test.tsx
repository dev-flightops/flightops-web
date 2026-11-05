import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, auth, getSchedule, listAircraft, getCompanyProfile, loadZoneTable, notFound } = vi.hoisted(() => {
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
    auth: vi.fn(),
    getSchedule: vi.fn(),
    listAircraft: vi.fn(),
    getCompanyProfile: vi.fn(),
    loadZoneTable: vi.fn(),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  };
});
// Next runs the forms on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/master-schedule", () => ({ getSchedule }));
vi.mock("@/lib/api/ops", () => ({ listAircraft }));
vi.mock("@/lib/api/auth", () => ({ getCompanyProfile, loadZoneTable }));
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({
  publishAction: vi.fn(),
  removeRouteAction: vi.fn(),
  saveRouteAction: vi.fn(),
  updateScheduleAction: vi.fn(),
  withdrawAction: vi.fn(),
}));

import ScheduleTemplatePage from "./page";

const ROUTE = {
  id: "r-1",
  flight_number: "GV101",
  aircraft: { id: "a-1", tail_number: "N100PA", model: "Cessna 208", is_active: true },
  legs: [
    { origin: "PANC", destination: "PABE", departs: "09:00", arrives: "10:17" },
    { origin: "PABE", destination: "PANC", departs: "10:45", arrives: "12:02" },
  ],
  days_of_week: [0, 1, 2, 3, 4],
  is_ifr: true,
  notes: "Morning Bethel",
};
const SCHEDULE = {
  id: "t-1",
  name: "Winter 2026",
  description: "The winter network",
  is_active: true,
  route_count: 1,
  last_publication: null,
  routes: [ROUTE],
  publications: [],
};
const params = Promise.resolve({ templateId: "t-1" });

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ roles: ["dispatcher"] });
  loadZoneTable.mockResolvedValue({ byIcao: {}, fallback: "America/Anchorage" });
  getSchedule.mockResolvedValue(SCHEDULE);
  listAircraft.mockResolvedValue({ items: [{ id: "a-1", tail_number: "N100PA", model: "Cessna 208", is_active: true }] });
  getCompanyProfile.mockResolvedValue({ ground_minutes: 20 });
});

describe("/schedule/master/[templateId]", () => {
  it("shows the flights as they fly", async () => {
    render(await ScheduleTemplatePage({ params }));
    expect(screen.getByRole("heading", { level: 1, name: "Winter 2026" })).toBeTruthy();
    expect(screen.getByText("GV101")).toBeTruthy();
    expect(screen.getByText("IFR")).toBeTruthy();
    expect(screen.getByText("PANC → PABE → PANC")).toBeTruthy();
    expect(screen.getByText("09:00–10:17, 10:45–12:02")).toBeTruthy();
    expect(screen.getByText("Mon–Fri")).toBeTruthy();
    expect(screen.getByText("12:02")).toBeTruthy();
    expect(screen.getByText("N100PA")).toBeTruthy();
    expect(screen.getByText("Morning Bethel")).toBeTruthy();
    expect(screen.getByText("Not published yet.")).toBeTruthy();
  });

  it("gives dispatch the controls", async () => {
    render(await ScheduleTemplatePage({ params }));
    expect(screen.getByRole("button", { name: "+ Add Flight" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit GV101" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove GV101" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("form", { name: "Publish to date range" })).toBeTruthy();
  });

  it("is read-only for anyone else, and doesn't ask for what they won't use", async () => {
    auth.mockResolvedValue({ roles: ["chief_pilot"] });
    render(await ScheduleTemplatePage({ params }));
    expect(screen.getByText("GV101")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ Add Flight" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit GV101" })).toBeNull();
    expect(screen.queryByRole("form", { name: "Publish to date range" })).toBeNull();
    expect(listAircraft).not.toHaveBeenCalled();
    expect(getCompanyProfile).not.toHaveBeenCalled();
  });

  it("won't offer to publish an empty or inactive schedule", async () => {
    getSchedule.mockResolvedValue({ ...SCHEDULE, routes: [] });
    const { unmount } = render(await ScheduleTemplatePage({ params }));
    expect(screen.getByText("Add at least one flight before publishing.")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Publish to date range" })).toBeNull();
    unmount();

    getSchedule.mockResolvedValue({ ...SCHEDULE, is_active: false });
    render(await ScheduleTemplatePage({ params }));
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getByText(/This schedule is inactive/)).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Publish to date range" })).toBeNull();
  });

  it.each([404, 422])("is not found on a %s", async (status) => {
    getSchedule.mockRejectedValue(new TestApiError(status, "/x", "{}"));
    await expect(ScheduleTemplatePage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("says so when it can't load", async () => {
    getSchedule.mockRejectedValue(new TestApiError(500, "/x", "boom"));
    render(await ScheduleTemplatePage({ params }));
    expect(screen.getByRole("alert").textContent).toMatch(/couldn.t be loaded/);
  });
});
