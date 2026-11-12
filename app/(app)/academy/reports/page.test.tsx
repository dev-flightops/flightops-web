import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, getAcademyReport, getAcademyReportFilterOptions } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getAcademyReport: vi.fn(), getAcademyReportFilterOptions: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/academy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/academy")>()),
  getAcademyReport,
  getAcademyReportFilterOptions,
}));

import AcademyReportsPage from "./page";

const PILOT_ID = "11111111-1111-4111-8111-111111111111";
const OPTIONS = {
  roles: ["chief_pilot", "pilot"],
  bases: ["PABE"],
  people: [{ id: PILOT_ID, full_name: "Pilot Tester" }],
};

async function renderPage(search: Record<string, string> = {}) {
  return render(await AcademyReportsPage({ searchParams: Promise.resolve(search) }));
}

function report(rows: unknown[]) {
  return { as_of: "2026-11-12", rows };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAcademyReport.mockResolvedValue(report([]));
  getAcademyReportFilterOptions.mockResolvedValue(OPTIONS);
});

describe("Academy → Reports", () => {
  it("opens on By Employee, with every filter it takes", async () => {
    getAcademyReport.mockResolvedValue(
      report([
        { user_id: PILOT_ID, full_name: "Pilot Tester", department: "Flight Ops", base: "PABE", assigned: 2, completed: 1, overdue: 1, avg_score: 90 },
      ]),
    );
    await renderPage();
    expect(getAcademyReport).toHaveBeenCalledWith("by-employee", {});
    expect(screen.getByRole("link", { name: "By Employee" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Completion by Employee" })).toBeInTheDocument();
    for (const label of ["From", "To", "Department", "Role", "Base", "Employee"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    const row = screen.getByRole("row", { name: /Pilot Tester/ });
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Pilot Tester", "Flight Ops", "PABE", "2", "1", "1", "90%"]);
    expect(screen.getByText("1 record · as of Nov 12, 2026")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Role")).getByRole("option", { name: "Chief Pilot" })).toBeInTheDocument();
  });

  it("sends the filters the report takes and drops the rest", async () => {
    await renderPage({ report: "by-course", from: "2026-11-01", to: "2026-11-30", category: "safety", role: "pilot", user_id: PILOT_ID });
    expect(getAcademyReport).toHaveBeenCalledWith("by-course", { from: "2026-11-01", to: "2026-11-30", category: "safety" });
    expect(screen.queryByLabelText("Role")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute(
      "href",
      "/academy/reports/csv?report=by-course&from=2026-11-01&to=2026-11-30&category=safety",
    );
  });

  it("drops a value that isn't one rather than sending it", async () => {
    await renderPage({ report: "nope", from: "2026-02-30", category: "nope", user_id: "abc" });
    expect(getAcademyReport).toHaveBeenCalledWith("by-employee", {});
  });

  it("keeps, on each tab, the filters that report takes", async () => {
    await renderPage({ from: "2026-11-01", category: "safety", role: "pilot" });
    expect(screen.getByRole("link", { name: "By Course" })).toHaveAttribute("href", "/academy/reports?report=by-course&from=2026-11-01&category=safety");
    expect(screen.getByRole("link", { name: "By Department" })).toHaveAttribute("href", "/academy/reports?report=by-department&category=safety");
    expect(screen.getByRole("link", { name: "Overdue Training" })).toHaveAttribute("href", "/academy/reports?report=overdue&category=safety&role=pilot");
  });

  it("By Department lists each department, without dates or people", async () => {
    getAcademyReport.mockResolvedValue(
      report([
        { category: "safety", courses: 2, assigned: 4, completed: 3, overdue: 1, completion_rate: 75 },
        { category: "records", courses: 0, assigned: 0, completed: 0, overdue: 0, completion_rate: 0 },
      ]),
    );
    await renderPage({ report: "by-department", from: "2026-11-01" });
    expect(getAcademyReport).toHaveBeenCalledWith("by-department", {});
    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Safety/ })).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Safety", "2", "4", "3", "1", "75%"]);
    // Nothing assigned: no rate rather than 0%.
    expect(within(screen.getByRole("row", { name: /Records/ })).getAllByRole("cell").at(-1)).toHaveTextContent("—");
  });

  it("By Course shows no pass figures for a course without a quiz", async () => {
    getAcademyReport.mockResolvedValue(
      report([
        { course_id: "c1", title: "Icing", category: "flight_operations", assigned: 3, completed: 1, passed: 1, pass_rate: 50, avg_score: 75 },
        { course_id: "c2", title: "Welcome", category: "general", assigned: 5, completed: 5, passed: null, pass_rate: null, avg_score: null },
      ]),
    );
    await renderPage({ report: "by-course" });
    expect(within(screen.getByRole("row", { name: /Icing/ })).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Icing", "Flight Operations", "3", "1", "1", "50%", "75%"]);
    expect(within(screen.getByRole("row", { name: /Welcome/ })).getAllByRole("cell").slice(-3).map((c) => c.textContent)).toEqual(["—", "—", "—"]);
  });

  it("Overdue Training gives the day it ran out and the days since", async () => {
    getAcademyReport.mockResolvedValue(
      report([{ user_id: PILOT_ID, full_name: "Pilot Tester", course_id: "c1", title: "Hazmat", category: "ground_operations_ramp", expired_on: "2026-11-02", days_overdue: 10 }]),
    );
    await renderPage({ report: "overdue" });
    expect(within(screen.getByRole("row", { name: /Hazmat/ })).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Pilot Tester",
      "Hazmat",
      "Ground Operations / Ramp",
      "Nov 2, 2026",
      "10d",
    ]);
  });

  it("Training Currency marks each person's standing", async () => {
    const row = { user_id: PILOT_ID, full_name: "Pilot Tester", category: "safety", cert_valid_days: 365 };
    getAcademyReport.mockResolvedValue(
      report([
        { ...row, course_id: "a", title: "Annual", last_completed: "2025-11-01", expires_on: "2026-11-01", days_left: -11, status: "expired" },
        { ...row, course_id: "b", title: "Brief", last_completed: "2026-01-01", expires_on: "2026-12-01", days_left: 19, status: "due_soon" },
        { ...row, course_id: "c", title: "Checkride", last_completed: "2026-10-01", expires_on: "2027-10-01", days_left: 323, status: "current" },
        { ...row, course_id: "d", title: "Drill", last_completed: null, expires_on: null, days_left: null, status: "never" },
      ]),
    );
    await renderPage({ report: "currency" });
    const status = (title: string) => within(screen.getByRole("row", { name: new RegExp(title) })).getAllByRole("cell");
    expect(status("Annual").map((c) => c.textContent)).toEqual(["Pilot Tester", "Annual", "365d", "Nov 1, 2025", "Nov 1, 2026", "-11d", "Expired"]);
    expect(status("Brief").at(-1)).toHaveTextContent("Due soon");
    expect(status("Checkride").at(-1)).toHaveTextContent("Current");
    expect(status("Drill").map((c) => c.textContent).slice(3)).toEqual(["Never", "—", "—", "Never"]);
  });

  it("asks for the dates to be swapped, without asking the service, when From is after To", async () => {
    await renderPage({ from: "2026-11-10", to: "2026-11-01" });
    expect(screen.getByRole("alert")).toHaveTextContent("The start date is after the end date");
    expect(getAcademyReport).not.toHaveBeenCalled();
  });

  it("says who the reports are for when the service refuses", async () => {
    getAcademyReport.mockRejectedValue(new TestApiError(403, "/academy/reports/by-employee", ""));
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Academy reports are for the Chief Pilot, the Director of Operations and Exec Admins.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("still shows the report when the filters' choices don't load, keeping the one in use", async () => {
    getAcademyReportFilterOptions.mockRejectedValue(new Error("down"));
    await renderPage({ role: "pilot" });
    expect(getAcademyReport).toHaveBeenCalledWith("by-employee", { role: "pilot" });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toHaveValue("pilot");
  });
});
