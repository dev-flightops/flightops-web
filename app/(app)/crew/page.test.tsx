import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CrewCalendar } from "@/lib/api/crew-calendar";

const { getCrewCalendar, auth, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    getCrewCalendar: vi.fn(),
    auth: vi.fn(async () => ({ roles: ["pilot"] as string[] })),
    TestApiError,
  };
});

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/crew-calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/crew-calendar")>()),
  getCrewCalendar,
}));
vi.mock("./actions", () => ({
  saveAssignmentAction: vi.fn(),
  deleteAssignmentAction: vi.fn(),
  moveHomeBaseAction: vi.fn(),
}));

import CrewCalendarPage from "./page";

const CALENDAR: CrewCalendar = {
  month: "2026-10",
  first_day: "2026-10-01",
  last_day: "2026-10-31",
  station: "PABE",
  stations: [
    { code: "PABE", name: "Bethel" },
    { code: "PANC", name: "Anchorage" },
  ],
  airframe_types: ["caravan"],
  aircraft: [],
  groups: [
    {
      station: "PABE",
      label: "PABE · Bethel",
      crew: [
        {
          user_id: "11111111-1111-4111-8111-111111111111",
          full_name: "Alice Pilot",
          station: "PABE",
          roles: ["pilot"],
        },
      ],
    },
  ],
  entries: [],
};

async function renderPage(params: Record<string, string> = {}) {
  const ui = await CrewCalendarPage({ searchParams: Promise.resolve(params) });
  return render(ui);
}

beforeEach(() => {
  vi.clearAllMocks();
  getCrewCalendar.mockResolvedValue(CALENDAR);
  auth.mockResolvedValue({ roles: ["pilot"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CrewCalendarPage", () => {
  it("asks for the month and base in the address, and links either side", async () => {
    await renderPage({ month: "2026-10", station: "pabe" });
    expect(getCrewCalendar).toHaveBeenCalledWith({ month: "2026-10", station: "PABE" });
    expect(screen.getByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous month" })).toHaveAttribute(
      "href",
      "/crew?month=2026-09&station=PABE",
    );
    expect(screen.getByRole("link", { name: "Next month" })).toHaveAttribute(
      "href",
      "/crew?month=2026-11&station=PABE",
    );
    expect(screen.getByRole("link", { name: "All bases" })).toHaveAttribute(
      "href",
      "/crew?month=2026-10",
    );
    expect(screen.getByRole("link", { name: "PABE" })).toHaveAttribute("aria-current", "page");
  });

  it("falls back to this month when the address has none, or a bad one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 5, 12));
    await renderPage({ month: "2026-13" });
    expect(getCrewCalendar).toHaveBeenCalledWith({ month: "2026-10", station: null });
    expect(screen.queryByRole("link", { name: "This month" })).toBeNull();
  });

  it("offers editing to a scheduler and not to a pilot", async () => {
    await renderPage({ month: "2026-10" });
    expect(screen.getByText("Alice Pilot")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add Assignment" })).toBeNull();

    auth.mockResolvedValue({ roles: ["chief_pilot"] });
    await renderPage({ month: "2026-10" });
    expect(screen.getByRole("button", { name: "+ Add Assignment" })).toBeInTheDocument();
  });

  it("says plainly when the calendar can't load", async () => {
    getCrewCalendar.mockRejectedValue(new TestApiError(503, "/ops/crew-calendar", "down"));
    await renderPage({ month: "2026-10" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The crew calendar is unavailable. Try refreshing in a moment.",
    );
  });

  it("says when a base has nobody on it", async () => {
    getCrewCalendar.mockResolvedValue({ ...CALENDAR, station: "PANC", groups: [] });
    await renderPage({ month: "2026-10", station: "PANC" });
    expect(
      screen.getByText("No crew are based at or assigned to PANC in October 2026."),
    ).toBeInTheDocument();
  });
});
