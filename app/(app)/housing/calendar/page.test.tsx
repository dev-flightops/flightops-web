import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  HousingBooking,
  HousingRoom,
  HousingUnit,
} from "@/lib/api/housing";

/**
 * /housing/calendar — rooms × seven days.
 *
 * Every date here is computed in UTC on purpose: the anchor, the seven
 * columns, the today highlight and the per-cell booking window. A single
 * one of them reading local calendar fields shifts the grid by a day
 * against the rest, which shows up as a booking block sitting in the
 * wrong column rather than as an error.
 */

const {
  TestApiError,
  listHousingUnits,
  listHousingBookings,
  getHousingUnit,
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
    listHousingUnits: vi.fn(),
    listHousingBookings: vi.fn(),
    getHousingUnit: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/housing", () => ({
  listHousingUnits,
  listHousingBookings,
  getHousingUnit,
  BOOKING_PURPOSE_LABELS: {
    crew_rest: "Crew Rest",
    training: "Training",
    travel: "Travel",
    rotation: "Rotation",
    maintenance: "Maintenance",
    other: "Other",
  },
}));

import HousingCalendarPage from "./page";

// Wednesday. Chosen so the Monday-of-this-week arithmetic has to do
// real work rather than being a no-op.
const WEDNESDAY = "2026-08-19";
const MONDAY = "2026-08-17";
const SUNDAY_END = "2026-08-23";

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

function room(over: Partial<HousingRoom> & { id: string }): HousingRoom {
  return {
    unit_id: "u-1",
    room_number: "101",
    room_type: "single",
    capacity: 1,
    status: "available",
    amenities: null,
    cost_per_night: null,
    has_wifi: false,
    has_kitchen: false,
    has_private_bath: false,
    has_laundry: false,
    ...over,
  } as HousingRoom;
}

function booking(over: Partial<HousingBooking> & { id: string }): HousingBooking {
  return {
    room_id: "r-1",
    room_number: "101",
    unit_id: "u-1",
    unit_name: "Bethel Crew House",
    employee_user_id: "e-1",
    employee_name: "Alice Chen",
    check_in: MONDAY,
    check_out: null,
    purpose: null,
    is_cancelled: false,
    cancelled_at: null,
    notes: null,
    ...over,
  } as HousingBooking;
}

/** One active unit with one room, unless a test overrides it. */
function seed({
  units = [unit({ id: "u-1" })],
  rooms = [room({ id: "r-1" })],
  bookings = [] as HousingBooking[],
} = {}) {
  listHousingUnits.mockResolvedValueOnce({ items: units });
  listHousingBookings.mockResolvedValueOnce({ items: bookings });
  for (const u of units.filter((x) => x.is_active)) {
    getHousingUnit.mockResolvedValueOnce({
      unit: u,
      rooms: rooms.filter((r) => r.unit_id === u.id),
    });
  }
}

async function renderPage(searchParams: { from?: string } = {}) {
  const ui = await HousingCalendarPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

const columnHeads = () =>
  within(screen.getByRole("table"))
    .getAllByRole("columnheader")
    .slice(1)
    .map((th) => th.textContent);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${WEDNESDAY}T12:00:00Z`));
  listHousingUnits.mockReset();
  listHousingBookings.mockReset();
  getHousingUnit.mockReset();
  listHousingUnits.mockResolvedValue({ items: [] });
  listHousingBookings.mockResolvedValue({ items: [] });
  getHousingUnit.mockResolvedValue({ unit: unit({ id: "u-1" }), rooms: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the week window", () => {
  it("anchors on this week's Monday when no date is given", async () => {
    seed();
    await renderPage();
    expect(listHousingBookings).toHaveBeenCalledWith({
      from: MONDAY,
      to: SUNDAY_END,
    });
  });

  it("treats Sunday as the end of the week it closes, not the start of the next", async () => {
    // getUTCDay() is 0 on Sunday; the naive `1 - day` would jump forward
    // six days into the following week instead of back.
    vi.setSystemTime(new Date("2026-08-23T12:00:00Z")); // a Sunday
    seed();
    await renderPage();
    expect(listHousingBookings).toHaveBeenCalledWith({
      from: MONDAY,
      to: SUNDAY_END,
    });
  });

  it("anchors on Monday itself without shifting", async () => {
    vi.setSystemTime(new Date(`${MONDAY}T12:00:00Z`));
    seed();
    await renderPage();
    expect(listHousingBookings).toHaveBeenCalledWith({
      from: MONDAY,
      to: SUNDAY_END,
    });
  });

  it("honours an explicit ?from", async () => {
    seed();
    await renderPage({ from: "2026-09-07" });
    expect(listHousingBookings).toHaveBeenCalledWith({
      from: "2026-09-07",
      to: "2026-09-13",
    });
  });

  it.each(["", "nonsense", "2026-8-1", "2026-09-07T00:00:00Z", "09-07-2026"])(
    "falls back to this week when ?from is %o",
    async (from) => {
      seed();
      await renderPage({ from });
      expect(listHousingBookings).toHaveBeenCalledWith({
        from: MONDAY,
        to: SUNDAY_END,
      });
    },
  );

  it("derives the week in UTC, not the host zone", async () => {
    // Both directions are needed. Tokyo (+9) catches the week anchor:
    // 21:00Z Sunday is already Monday there, so reading local calendar
    // fields picks the wrong week. Anchorage (−8) catches the day
    // formatting: the anchor is a UTC midnight, which is still the
    // previous afternoon locally, so a local-field isoDay() reports the
    // day before. Going east alone misses that second case entirely.
    for (const tz of ["Asia/Tokyo", "America/Anchorage"]) {
      process.env.TZ = tz;
      vi.setSystemTime(new Date("2026-08-23T21:00:00Z"));
      listHousingBookings.mockClear();
      seed();
      const { unmount } = await renderPage();
      expect(listHousingBookings, `week shifted under TZ=${tz}`).toHaveBeenCalledWith({
        from: MONDAY,
        to: SUNDAY_END,
      });
      unmount();
    }
    process.env.TZ = "UTC";
  });

  it("renders seven columns, Monday through Sunday", async () => {
    seed();
    await renderPage();
    const heads = columnHeads();
    expect(heads).toHaveLength(7);
    expect(heads[0]).toMatch(/^Mon/);
    expect(heads[6]).toMatch(/^Sun/);
    expect(heads[0]).toContain("17");
    expect(heads[6]).toContain("23");
  });

  it("crosses a month boundary without repeating or skipping a day", async () => {
    seed();
    await renderPage({ from: "2026-08-31" });
    const nums = columnHeads().map((t) => t!.replace(/\D/g, ""));
    expect(nums).toEqual(["31", "1", "2", "3", "4", "5", "6"]);
  });
});

describe("week navigation", () => {
  it("steps a whole week in each direction", async () => {
    seed();
    await renderPage();
    expect(screen.getByRole("link", { name: /Prev week/ })).toHaveAttribute(
      "href",
      "/housing/calendar?from=2026-08-10",
    );
    expect(screen.getByRole("link", { name: /Next week/ })).toHaveAttribute(
      "href",
      "/housing/calendar?from=2026-08-24",
    );
  });

  it("steps back across a month boundary correctly", async () => {
    seed();
    await renderPage({ from: "2026-09-07" });
    expect(screen.getByRole("link", { name: /Prev week/ })).toHaveAttribute(
      "href",
      "/housing/calendar?from=2026-08-31",
    );
  });

  it("highlights Today only while the current week is shown", async () => {
    seed();
    const { unmount } = await renderPage();
    expect(screen.getByRole("link", { name: "Today" }).className).toMatch(
      /bg-status-blue/,
    );
    unmount();

    seed();
    await renderPage({ from: "2026-09-07" });
    expect(screen.getByRole("link", { name: "Today" }).className).not.toMatch(
      /bg-status-blue/,
    );
  });

  it("marks today's column in the grid", async () => {
    seed();
    await renderPage();
    const heads = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .slice(1);
    // Wednesday is index 2 of a Monday-anchored week.
    expect(heads[2].className).toMatch(/bg-status-blue/);
    expect(heads[0].className).not.toMatch(/bg-status-blue/);
  });
});

describe("which bookings land in which cell", () => {
  const cellsForRoom = () => {
    const row = within(screen.getByRole("table"))
      .getAllByRole("row")
      .find((r) => within(r).queryByText(/101/));
    return within(row!).getAllByRole("cell").slice(1);
  };

  it("fills every day a stay covers", async () => {
    seed({
      bookings: [
        booking({ id: "b-1", check_in: "2026-08-18", check_out: "2026-08-20" }),
      ],
    });
    await renderPage();
    const filled = cellsForRoom().map((c) => within(c).queryAllByRole("link").length);
    // Tue, Wed, Thu — inclusive at both ends.
    expect(filled).toEqual([0, 1, 1, 1, 0, 0, 0]);
  });

  it("runs an open-ended stay to the end of the window", async () => {
    seed({
      bookings: [
        booking({ id: "b-1", check_in: "2026-08-20", check_out: null }),
      ],
    });
    await renderPage();
    const filled = cellsForRoom().map((c) => within(c).queryAllByRole("link").length);
    expect(filled).toEqual([0, 0, 0, 1, 1, 1, 1]);
  });

  it("clips a stay that began before the window", async () => {
    seed({
      bookings: [
        booking({ id: "b-1", check_in: "2026-07-01", check_out: "2026-08-18" }),
      ],
    });
    await renderPage();
    const filled = cellsForRoom().map((c) => within(c).queryAllByRole("link").length);
    expect(filled).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });

  it("leaves cancelled bookings out of the grid entirely", async () => {
    seed({
      bookings: [
        booking({
          id: "b-1",
          check_in: MONDAY,
          check_out: SUNDAY_END,
          is_cancelled: true,
        }),
      ],
    });
    await renderPage();
    const filled = cellsForRoom().map((c) => within(c).queryAllByRole("link").length);
    expect(filled).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("stacks two stays that overlap on one day", async () => {
    seed({
      bookings: [
        booking({ id: "b-1", check_in: MONDAY, check_out: "2026-08-18", employee_name: "Alice Chen" }),
        booking({ id: "b-2", check_in: "2026-08-18", check_out: "2026-08-19", employee_name: "Bob Henderson" }),
      ],
    });
    await renderPage();
    const tuesday = cellsForRoom()[1];
    expect(within(tuesday).getAllByRole("link")).toHaveLength(2);
  });

  it("keeps each room's bookings in its own row", async () => {
    seed({
      rooms: [
        room({ id: "r-1", room_number: "101" }),
        room({ id: "r-2", room_number: "102" }),
      ],
      bookings: [
        booking({ id: "b-1", room_id: "r-2", employee_name: "Bob Henderson" }),
      ],
    });
    await renderPage();
    const rowFor = (n: string) =>
      within(screen.getByRole("table"))
        .getAllByRole("row")
        .find((r) => within(r).queryByText(new RegExp(n)))!;
    expect(within(rowFor("101")).queryByText(/BH/)).not.toBeInTheDocument();
    expect(within(rowFor("102")).getAllByText(/BH/).length).toBeGreaterThan(0);
  });
});

describe("booking blocks", () => {
  it("shows first and last initials", async () => {
    seed({ bookings: [booking({ id: "b-1", employee_name: "Alice Chen" })] });
    await renderPage();
    expect(screen.getAllByText(/^AC/)[0]).toBeInTheDocument();
  });

  it("uses first and last of a three-part name, not the middle", async () => {
    seed({
      bookings: [booking({ id: "b-1", employee_name: "Mary Jane Watson" })],
    });
    await renderPage();
    expect(screen.getAllByText(/^MW/)[0]).toBeInTheDocument();
  });

  it("copes with a single-word name", async () => {
    seed({ bookings: [booking({ id: "b-1", employee_name: "Cher" })] });
    await renderPage();
    expect(screen.getAllByText(/^CC/)[0]).toBeInTheDocument();
  });

  it("falls back to a placeholder when the employee has no name", async () => {
    seed({ bookings: [booking({ id: "b-1", employee_name: null })] });
    await renderPage();
    const block = screen.getAllByRole("link", { name: /Other/ })[0];
    expect(block).toHaveAttribute("title", expect.stringContaining("Assigned"));
  });

  it("labels an absent purpose as Other rather than blank", async () => {
    seed({ bookings: [booking({ id: "b-1", purpose: null })] });
    await renderPage();
    expect(screen.getAllByText(/Other/)[0]).toBeInTheDocument();
  });

  it("labels a known purpose", async () => {
    seed({ bookings: [booking({ id: "b-1", purpose: "crew_rest" })] });
    await renderPage();
    const blocks = screen.getAllByRole("link", { name: /Crew Rest/ });
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("carries the stay's dates in the tooltip", async () => {
    seed({
      bookings: [
        booking({ id: "b-1", check_in: MONDAY, check_out: "2026-08-18" }),
      ],
    });
    await renderPage();
    const block = screen.getAllByRole("link", { name: /AC/ })[0];
    expect(block).toHaveAttribute(
      "title",
      `Alice Chen · Other · ${MONDAY} → 2026-08-18`,
    );
  });

  it("says open in the tooltip for an open-ended stay", async () => {
    seed({ bookings: [booking({ id: "b-1", check_out: null })] });
    await renderPage();
    const block = screen.getAllByRole("link", { name: /AC/ })[0];
    expect(block.getAttribute("title")).toMatch(/→ open$/);
  });

  it("links a block to the unit detail", async () => {
    seed({ bookings: [booking({ id: "b-1" })] });
    await renderPage();
    expect(screen.getAllByRole("link", { name: /AC/ })[0]).toHaveAttribute(
      "href",
      "/housing/u-1",
    );
  });
});

describe("unit accent colour", () => {
  it("uses a valid hex accent for the block", async () => {
    seed({
      units: [unit({ id: "u-1", color_accent: "#ff0000" })],
      bookings: [booking({ id: "b-1" })],
    });
    await renderPage();
    const block = screen.getAllByRole("link", { name: /AC/ })[0];
    expect(block).toHaveStyle({ backgroundColor: "#ff0000" });
  });

  it.each(["red", "#fff", "javascript:alert(1)", "#12345g"])(
    "falls back to the default when the accent is %o",
    async (accent) => {
      // Anything not a six-digit hex is rejected rather than passed
      // through into a style attribute.
      seed({
        units: [unit({ id: "u-1", color_accent: accent })],
        bookings: [booking({ id: "b-1" })],
      });
      await renderPage();
      const block = screen.getAllByRole("link", { name: /AC/ })[0];
      expect(block).toHaveStyle({ backgroundColor: "#3b82f6" });
    },
  );
});

describe("rooms and units", () => {
  it("sorts rooms numerically within a unit", async () => {
    seed({
      rooms: [
        room({ id: "r-3", room_number: "10" }),
        room({ id: "r-1", room_number: "2" }),
        room({ id: "r-2", room_number: "1" }),
      ],
    });
    await renderPage();
    const nums = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[0].textContent?.match(/\d+/)?.[0]);
    expect(nums).toEqual(["1", "2", "10"]);
  });

  it("says a unit has no rooms rather than rendering an empty row", async () => {
    seed({ rooms: [] });
    await renderPage();
    expect(screen.getByText(/No rooms yet/i)).toBeInTheDocument();
  });

  it("leaves inactive units out and does not fetch their rooms", async () => {
    listHousingUnits.mockResolvedValueOnce({
      items: [
        unit({ id: "u-1", name: "Live House" }),
        unit({ id: "u-2", name: "Closed House", is_active: false }),
      ],
    });
    listHousingBookings.mockResolvedValueOnce({ items: [] });
    getHousingUnit.mockResolvedValueOnce({
      unit: unit({ id: "u-1" }),
      rooms: [room({ id: "r-1" })],
    });
    await renderPage();
    expect(getHousingUnit).toHaveBeenCalledTimes(1);
    expect(getHousingUnit).toHaveBeenCalledWith("u-1");
    expect(screen.queryByText("Closed House")).not.toBeInTheDocument();
  });
});

describe("empty and error states", () => {
  it("points at Housing when there are no active units", async () => {
    listHousingUnits.mockResolvedValueOnce({ items: [] });
    listHousingBookings.mockResolvedValueOnce({ items: [] });
    await renderPage();
    expect(screen.getByText(/No active housing units/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Housing/ })).toHaveAttribute(
      "href",
      "/housing",
    );
  });

  it.each([
    [401, /session expired/i],
    [500, /unavailable/i],
  ])("explains a %i without showing an empty grid", async (status, msg) => {
    listHousingUnits.mockRejectedValueOnce(
      new TestApiError(status, "/housing/units", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(msg);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/No active housing units/i)).not.toBeInTheDocument();
  });

  it("fails the page when one unit's rooms cannot be fetched", async () => {
    // The room fetches are in the same Promise.all as the bookings, so a
    // single failure takes the grid down rather than silently drawing a
    // unit with no rooms.
    listHousingUnits.mockResolvedValueOnce({ items: [unit({ id: "u-1" })] });
    listHousingBookings.mockResolvedValueOnce({ items: [] });
    getHousingUnit.mockRejectedValueOnce(
      new TestApiError(500, "/housing/units/u-1", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });
});
