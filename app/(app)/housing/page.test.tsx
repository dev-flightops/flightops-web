import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HousingBooking, HousingUnit } from "@/lib/api/housing";

/**
 * /housing — the units grid and today's occupancy rollup.
 *
 * "Occupied today" is a window calculation over check-in/check-out, and
 * the boundaries are inclusive on both ends: someone checking out today
 * still slept here last night and still holds the room. Those edges are
 * what the tests spend most of their time on.
 */

const { TestApiError, listHousingUnits, listHousingBookings } = vi.hoisted(() => {
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
    listHousingUnits: vi.fn(),
    listHousingBookings: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/housing", () => ({ listHousingUnits, listHousingBookings }));
vi.mock("./new-unit-form", () => ({
  NewUnitDrawer: () => <div data-testid="new-unit-drawer" />,
}));

import HousingPage from "./page";

const TODAY = "2026-08-15";

function unit(over: Partial<HousingUnit> & { id: string }): HousingUnit {
  return {
    name: "Bethel Crew House",
    station: "PABE",
    address: null,
    contact_person: null,
    contact_phone: null,
    color_accent: null,
    notes: null,
    is_active: true,
    ...over,
  } as HousingUnit;
}

function booking(over: Partial<HousingBooking> & { id: string }): HousingBooking {
  return {
    room_id: "r-1",
    room_number: "101",
    unit_id: "u-1",
    unit_name: "Bethel Crew House",
    employee_user_id: "e-1",
    employee_name: "Alice Chen",
    check_in: TODAY,
    check_out: null,
    purpose: null,
    is_cancelled: false,
    cancelled_at: null,
    notes: null,
    ...over,
  } as HousingBooking;
}

const renderPage = async () => render(await HousingPage());

// The rollup and each unit card both render "N occupied today", so the
// window tests below have to say which one they mean.
const header = () => screen.getByRole("heading", { level: 1 }).closest("header")!;
const rollup = (text: string) => within(header()).getByText(text);

beforeEach(() => {
  // Pinned so the occupancy window is deterministic. Without this the
  // suite passes or fails depending on the clock — a booking written
  // relative to "today" lands in the past or the future by the hour.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  listHousingUnits.mockReset();
  listHousingBookings.mockReset();
  listHousingUnits.mockResolvedValue({ items: [] });
  listHousingBookings.mockResolvedValue({ items: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("today's date", () => {
  it("asks the API for bookings from today", async () => {
    await renderPage();
    expect(listHousingBookings).toHaveBeenCalledWith({ from: TODAY });
  });

  it("derives today in UTC, not the host zone", async () => {
    // 21:00Z on the 15th is already the 16th in Tokyo. Reading local
    // calendar fields would ask the API for the wrong day and shift the
    // whole occupancy window.
    process.env.TZ = "Asia/Tokyo";
    vi.setSystemTime(new Date(`${TODAY}T21:00:00Z`));
    await renderPage();
    expect(listHousingBookings).toHaveBeenCalledWith({ from: TODAY });
    process.env.TZ = "UTC";
  });
});

describe("the occupancy window", () => {
  const withBookings = (items: HousingBooking[]) => {
    listHousingUnits.mockResolvedValueOnce({ items: [unit({ id: "u-1" })] });
    listHousingBookings.mockResolvedValueOnce({ items });
  };

  it("counts an open-ended stay that began before today", async () => {
    withBookings([
      booking({ id: "b-1", check_in: "2026-08-01", check_out: null }),
    ]);
    await renderPage();
    expect(rollup("1 occupied today")).toBeInTheDocument();
  });

  it("counts someone checking in today", async () => {
    withBookings([booking({ id: "b-1", check_in: TODAY, check_out: "2026-08-20" })]);
    await renderPage();
    expect(rollup("1 occupied today")).toBeInTheDocument();
  });

  it("still counts someone checking out today", async () => {
    // Inclusive on the way out: the room is not free for anyone else
    // until the checkout has happened.
    withBookings([booking({ id: "b-1", check_in: "2026-08-01", check_out: TODAY })]);
    await renderPage();
    expect(rollup("1 occupied today")).toBeInTheDocument();
  });

  it("ignores a stay that ended yesterday", async () => {
    withBookings([
      booking({ id: "b-1", check_in: "2026-08-01", check_out: "2026-08-14" }),
    ]);
    await renderPage();
    expect(rollup("0 occupied today")).toBeInTheDocument();
  });

  it("ignores a stay that starts tomorrow", async () => {
    withBookings([
      booking({ id: "b-1", check_in: "2026-08-16", check_out: "2026-08-20" }),
    ]);
    await renderPage();
    expect(rollup("0 occupied today")).toBeInTheDocument();
  });

  it("ignores a cancelled booking even while its dates cover today", async () => {
    withBookings([
      booking({
        id: "b-1",
        check_in: "2026-08-01",
        check_out: "2026-08-20",
        is_cancelled: true,
      }),
    ]);
    await renderPage();
    expect(rollup("0 occupied today")).toBeInTheDocument();
  });
});

describe("per-unit occupancy", () => {
  it("attributes each booking to its own unit", async () => {
    listHousingUnits.mockResolvedValueOnce({
      items: [
        unit({ id: "u-1", name: "Bethel Crew House" }),
        unit({ id: "u-2", name: "Dillingham Dorm" }),
      ],
    });
    listHousingBookings.mockResolvedValueOnce({
      items: [
        booking({ id: "b-1", unit_id: "u-1" }),
        booking({ id: "b-2", unit_id: "u-1" }),
        booking({ id: "b-3", unit_id: "u-2" }),
      ],
    });
    await renderPage();
    const card = (name: string) =>
      screen.getByRole("heading", { level: 3, name }).closest("li")!;
    expect(within(card("Bethel Crew House")).getByText("2 occupied today")).toBeInTheDocument();
    expect(within(card("Dillingham Dorm")).getByText("1 occupied today")).toBeInTheDocument();
  });

  it("shows zero for a unit with no bookings rather than omitting the line", async () => {
    listHousingUnits.mockResolvedValueOnce({
      items: [unit({ id: "u-1" }), unit({ id: "u-2", name: "Empty House" })],
    });
    listHousingBookings.mockResolvedValueOnce({
      items: [booking({ id: "b-1", unit_id: "u-1" })],
    });
    await renderPage();
    const card = screen.getByRole("heading", { level: 3, name: "Empty House" }).closest("li")!;
    expect(within(card).getByText("0 occupied today")).toBeInTheDocument();
  });

  it("does not crash on a booking with no unit", async () => {
    // room_id is required but unit_id is nullable in the API type; a
    // booking that arrives detached must not take the page down.
    listHousingUnits.mockResolvedValueOnce({ items: [unit({ id: "u-1" })] });
    listHousingBookings.mockResolvedValueOnce({
      items: [booking({ id: "b-1", unit_id: null })],
    });
    await renderPage();
    // Still counted in the header rollup, but attributed to no card.
    expect(rollup("1 occupied today")).toBeInTheDocument();
    const card = screen.getByRole("heading", { level: 3 }).closest("li")!;
    expect(within(card).getByText("0 occupied today")).toBeInTheDocument();
  });
});

describe("active and inactive units", () => {
  it("separates them and counts each section", async () => {
    listHousingUnits.mockResolvedValueOnce({
      items: [
        unit({ id: "u-1", name: "Live House", is_active: true }),
        unit({ id: "u-2", name: "Closed House", is_active: false }),
        unit({ id: "u-3", name: "Other Live", is_active: true }),
      ],
    });
    await renderPage();
    const section = (name: RegExp) =>
      screen.getByRole("heading", { level: 2, name }).closest("section")!;
    expect(within(section(/Active/)).getByText("Live House")).toBeInTheDocument();
    expect(within(section(/Inactive/)).getByText("Closed House")).toBeInTheDocument();
    expect(section(/Active/)).toHaveTextContent("Active · 2");
    expect(section(/Inactive/)).toHaveTextContent("Inactive · 1");
  });

  it("omits the inactive section when every unit is live", async () => {
    listHousingUnits.mockResolvedValueOnce({
      items: [unit({ id: "u-1" })],
    });
    await renderPage();
    expect(
      screen.queryByRole("heading", { level: 2, name: /Inactive/ }),
    ).not.toBeInTheDocument();
  });

  it("counts only active units as houses in the header", async () => {
    listHousingUnits.mockResolvedValueOnce({
      items: [
        unit({ id: "u-1", is_active: true }),
        unit({ id: "u-2", is_active: false }),
        unit({ id: "u-3", is_active: false }),
      ],
    });
    await renderPage();
    expect(screen.getByText(/2 inactive/)).toBeInTheDocument();
    expect(screen.getByText(/1 active house(?!s)/)).toBeInTheDocument();
  });

  it("leaves the inactive note out when there are none", async () => {
    listHousingUnits.mockResolvedValueOnce({ items: [unit({ id: "u-1" })] });
    await renderPage();
    expect(screen.queryByText(/inactive/)).not.toBeInTheDocument();
  });
});

describe("unit cards", () => {
  it("links to the unit and shows its station", async () => {
    listHousingUnits.mockResolvedValueOnce({
      items: [unit({ id: "u-42", station: "PADU" })],
    });
    await renderPage();
    expect(screen.getByRole("link", { name: /Open →/ })).toHaveAttribute(
      "href",
      "/housing/u-42",
    );
    expect(screen.getByText("PADU")).toBeInTheDocument();
  });

  it("shows a contact phone only alongside a contact person", async () => {
    // A bare phone number with no name attached is not actionable.
    listHousingUnits.mockResolvedValueOnce({
      items: [
        unit({ id: "u-1", contact_person: null, contact_phone: "907-555-0100" }),
      ],
    });
    await renderPage();
    expect(screen.queryByText(/907-555-0100/)).not.toBeInTheDocument();
  });

  it("shows both when the person is named", async () => {
    listHousingUnits.mockResolvedValueOnce({
      items: [
        unit({ id: "u-1", contact_person: "Bob Henderson", contact_phone: "907-555-0100" }),
      ],
    });
    await renderPage();
    expect(screen.getByText(/Bob Henderson/)).toBeInTheDocument();
    expect(screen.getByText(/907-555-0100/)).toBeInTheDocument();
  });
});

describe("empty and error states", () => {
  it("invites a first unit when there are none", async () => {
    await renderPage();
    expect(screen.getByText(/No housing units yet/i)).toBeInTheDocument();
  });

  it.each([
    [401, /session expired/i],
    [500, /unavailable/i],
  ])("explains a %i without claiming there are no units", async (status, msg) => {
    listHousingUnits.mockRejectedValueOnce(
      new TestApiError(status, "/housing/units", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(msg);
    expect(screen.queryByText(/No housing units yet/i)).not.toBeInTheDocument();
  });

  it("withholds the unit cards when the bookings call fails", async () => {
    // Both calls share one try/catch on purpose: showing every unit as
    // "0 occupied" because the bookings feed died would read as plenty
    // of free beds.
    listHousingUnits.mockResolvedValueOnce({ items: [unit({ id: "u-1" })] });
    listHousingBookings.mockRejectedValueOnce(
      new TestApiError(500, "/housing/bookings", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open →/ })).not.toBeInTheDocument();
  });

  it("withholds the header rollup on a failed load", async () => {
    // The counters start at zero, so rendering them beside the alert
    // reads as "no houses, none occupied" rather than "we could not find
    // out" — the same confusion the empty-state tests prevent elsewhere
    // on this page.
    listHousingUnits.mockRejectedValueOnce(
      new TestApiError(500, "/housing/units", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(within(header()).queryByText(/occupied today/)).not.toBeInTheDocument();
    expect(within(header()).queryByText(/active house/)).not.toBeInTheDocument();
    // The title stays — the page is still the housing page.
    expect(within(header()).getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("offers the calendar", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: /Calendar/ })).toHaveAttribute(
      "href",
      "/housing/calendar",
    );
  });
});
