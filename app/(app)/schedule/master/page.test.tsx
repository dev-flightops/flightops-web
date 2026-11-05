import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, listSchedules, loadZoneTable } = vi.hoisted(() => ({
  auth: vi.fn(),
  listSchedules: vi.fn(),
  loadZoneTable: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/master-schedule", () => ({ listSchedules }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("./new-schedule", () => ({ NewSchedule: () => <button>+ New Schedule</button> }));
vi.mock("./actions", () => ({ withdrawAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import MasterSchedulePage from "./page";

const PUBLICATION = {
  id: "p-1",
  template_id: "t-1",
  template_name: "Winter 2026",
  name: "First week",
  start_date: "2026-11-09",
  end_date: "2026-11-15",
  published_at: "2026-11-05T20:00:00Z",
  published_by: "Dana Whitfield",
  flights_created: 14,
  flights_already_there: 1,
  problem_count: 1,
  problems: [{ date: "2026-11-10", flight_number: "GV102", code: "aircraft_busy", message: "N100PA is on CH900 at that time." }],
  withdrawn_at: null,
  withdrawn_by: null,
  flights_removed: null,
};
const SCHEDULE = {
  id: "t-1",
  name: "Winter 2026",
  description: "The winter network",
  is_active: true,
  route_count: 2,
  last_publication: PUBLICATION,
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ roles: ["dispatcher"] });
  loadZoneTable.mockResolvedValue({ byIcao: {}, fallback: "America/Anchorage" });
  listSchedules.mockResolvedValue({ items: [SCHEDULE], publications: [PUBLICATION] });
});

describe("/schedule/master", () => {
  it("lists the schedules and what was published", async () => {
    render(await MasterSchedulePage());
    expect(screen.getByRole("heading", { level: 1, name: "Master Schedule" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Winter 2026" })[0].getAttribute("href")).toBe("/schedule/master/t-1");
    expect(screen.getByText("The winter network")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Nov 9, 2026 to Nov 15, 2026")).toBeTruthy();
    expect(screen.getByText("by Dana Whitfield")).toBeTruthy();
    expect(screen.getByText(/N100PA is on CH900/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Withdraw First week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ New Schedule" })).toBeTruthy();
  });

  it("is read-only for anyone who can't make a flight", async () => {
    auth.mockResolvedValue({ roles: ["chief_pilot"] });
    render(await MasterSchedulePage());
    expect(screen.queryByRole("button", { name: "+ New Schedule" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Withdraw/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Winter 2026" }).length).toBeGreaterThan(0);
  });

  it("says what a withdrawn publication did", async () => {
    listSchedules.mockResolvedValue({
      items: [SCHEDULE],
      publications: [{ ...PUBLICATION, withdrawn_at: "2026-11-05T21:00:00Z", withdrawn_by: "Dana", flights_removed: 12 }],
    });
    render(await MasterSchedulePage());
    expect(screen.getByText("Withdrawn Nov 5: 12 removed, 2 stayed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Withdraw/ })).toBeNull();
  });

  it("starts empty with what to do", async () => {
    listSchedules.mockResolvedValue({ items: [], publications: [] });
    render(await MasterSchedulePage());
    expect(screen.getByText(/No schedules yet\. Create one/)).toBeTruthy();
    expect(screen.queryByText("Published")).toBeNull();
  });

  it("says so when it can't load", async () => {
    listSchedules.mockRejectedValue(new Error("down"));
    render(await MasterSchedulePage());
    expect(screen.getByRole("alert").textContent).toMatch(/couldn.t be loaded/);
  });
});
