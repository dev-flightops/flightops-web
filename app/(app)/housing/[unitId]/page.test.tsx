import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  HousingBooking,
  HousingRoom,
  HousingUnit,
} from "@/lib/api/housing";

/**
 * /housing/[unitId] — rooms and bookings for one unit.
 *
 * Two things here are easy to get subtly wrong and hard to spot: room
 * numbers sorting as strings ("10" before "2"), and a room marked
 * available in the catalogue that today's bookings say is slept in. The
 * badge has to reconcile those two sources rather than trusting either.
 */

const {
  TestApiError,
  getHousingUnit,
  listHousingBookings,
  notFound,
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
  class NotFoundSignal extends Error {}
  return {
    TestApiError,
    getHousingUnit: vi.fn(),
    listHousingBookings: vi.fn(),
    notFound: vi.fn(() => {
      throw new NotFoundSignal("NEXT_NOT_FOUND");
    }),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/api/housing", () => ({
  getHousingUnit,
  listHousingBookings,
  ROOM_TYPE_LABELS: {
    single: "Single",
    double: "Double",
    bunk: "Bunk",
    supervisor_suite: "Supervisor Suite",
    crew_house: "Crew House",
  },
  ROOM_STATUS_LABELS: {
    available: "Available",
    occupied: "Occupied",
    maintenance: "Maintenance",
    offline: "Offline",
  },
}));
vi.mock("./add-room-form", () => ({
  AddRoomDrawer: ({ unitId }: { unitId: string }) => (
    <div data-testid="add-room" data-unit-id={unitId} />
  ),
}));

import HousingUnitDetailPage from "./page";

const TODAY = "2026-08-15";
const UNIT_ID = "u-1";

function unit(over: Partial<HousingUnit> = {}): HousingUnit {
  return {
    id: UNIT_ID,
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
    unit_id: UNIT_ID,
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
    unit_id: UNIT_ID,
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

async function renderPage(unitId = UNIT_ID) {
  const ui = await HousingUnitDetailPage({ params: Promise.resolve({ unitId }) });
  return render(ui);
}

const roomsTable = () =>
  screen.getByRole("heading", { level: 2, name: "Rooms" }).closest("section")!;
const bookingsTable = () =>
  screen.getByRole("heading", { level: 2, name: "Bookings" }).closest("section")!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  getHousingUnit.mockReset();
  listHousingBookings.mockReset();
  notFound.mockClear();
  getHousingUnit.mockResolvedValue({ unit: unit(), rooms: [] });
  listHousingBookings.mockResolvedValue({ items: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loading", () => {
  it("requests the unit named in the route", async () => {
    await renderPage("u-42");
    expect(getHousingUnit).toHaveBeenCalledWith("u-42");
  });

  it("renders the 404 page when the unit does not exist", async () => {
    getHousingUnit.mockRejectedValueOnce(
      new TestApiError(404, "/housing/units/u-1", "gone"),
    );
    await expect(renderPage()).rejects.toThrow(/NEXT_NOT_FOUND/);
    expect(notFound).toHaveBeenCalled();
  });

  it("lets any other failure surface", async () => {
    getHousingUnit.mockRejectedValueOnce(
      new TestApiError(500, "/housing/units/u-1", "boom"),
    );
    await expect(renderPage()).rejects.toThrow("boom");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("still renders the unit when the bookings call fails", async () => {
    // Rooms are the point of the page; a dead bookings feed should cost
    // the occupied badges, not the whole unit.
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1" })],
    });
    listHousingBookings.mockRejectedValueOnce(new Error("nope"));
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Bethel Crew House",
    );
    expect(within(roomsTable()).getByText("101")).toBeInTheDocument();
  });

  it("keeps only this unit's bookings", async () => {
    // The endpoint is not scoped to a unit, so the page filters. Without
    // it another house's guest would appear in this one's list and mark
    // a room here occupied.
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1" })],
    });
    listHousingBookings.mockResolvedValueOnce({
      items: [
        booking({ id: "b-1", unit_id: UNIT_ID, employee_name: "Ours" }),
        booking({ id: "b-2", unit_id: "u-other", employee_name: "Theirs" }),
      ],
    });
    await renderPage();
    expect(within(bookingsTable()).getByText("Ours")).toBeInTheDocument();
    expect(within(bookingsTable()).queryByText("Theirs")).not.toBeInTheDocument();
  });
});

describe("room ordering", () => {
  it("sorts room numbers numerically, not as strings", async () => {
    // Plain string ordering puts "10" before "2", which reads as a
    // data error to anyone looking down the column.
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [
        room({ id: "r-3", room_number: "10" }),
        room({ id: "r-1", room_number: "2" }),
        room({ id: "r-2", room_number: "1" }),
      ],
    });
    await renderPage();
    const cells = within(roomsTable())
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[0].textContent);
    expect(cells).toEqual(["1", "2", "10"]);
  });

  it("sums capacity across rooms", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [
        room({ id: "r-1", capacity: 2 }),
        room({ id: "r-2", room_number: "102", capacity: 3 }),
      ],
    });
    await renderPage();
    expect(roomsTable()).toHaveTextContent("2 rooms · 5 beds");
  });

  it("says so plainly when no rooms have been added", async () => {
    await renderPage();
    expect(screen.getByText(/No rooms added yet/i)).toBeInTheDocument();
  });
});

describe("room status badge", () => {
  const withRoomAndBooking = (
    roomOver: Partial<HousingRoom>,
    bookings: HousingBooking[],
  ) => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1", ...roomOver })],
    });
    listHousingBookings.mockResolvedValueOnce({ items: bookings });
  };

  it("reads In use when an available room is slept in today", async () => {
    withRoomAndBooking({ status: "available" }, [
      booking({ id: "b-1", room_id: "r-1", check_in: "2026-08-01" }),
    ]);
    await renderPage();
    expect(within(roomsTable()).getByText("In use")).toBeInTheDocument();
  });

  it("reads Available when nobody is in it", async () => {
    withRoomAndBooking({ status: "available" }, []);
    await renderPage();
    expect(within(roomsTable()).getByText("Available")).toBeInTheDocument();
  });

  it("does not count a cancelled booking as occupancy", async () => {
    withRoomAndBooking({ status: "available" }, [
      booking({ id: "b-1", room_id: "r-1", is_cancelled: true }),
    ]);
    await renderPage();
    expect(within(roomsTable()).getByText("Available")).toBeInTheDocument();
  });

  it("does not count a booking that ended yesterday", async () => {
    withRoomAndBooking({ status: "available" }, [
      booking({
        id: "b-1",
        room_id: "r-1",
        check_in: "2026-08-01",
        check_out: "2026-08-14",
      }),
    ]);
    await renderPage();
    expect(within(roomsTable()).getByText("Available")).toBeInTheDocument();
  });

  it("counts a booking that checks out today", async () => {
    withRoomAndBooking({ status: "available" }, [
      booking({
        id: "b-1",
        room_id: "r-1",
        check_in: "2026-08-01",
        check_out: TODAY,
      }),
    ]);
    await renderPage();
    expect(within(roomsTable()).getByText("In use")).toBeInTheDocument();
  });

  it("attributes occupancy to the booked room only", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [
        room({ id: "r-1", room_number: "101" }),
        room({ id: "r-2", room_number: "102" }),
      ],
    });
    listHousingBookings.mockResolvedValueOnce({
      items: [booking({ id: "b-1", room_id: "r-2" })],
    });
    await renderPage();
    const rowFor = (n: string) =>
      within(roomsTable())
        .getAllByRole("row")
        .find((r) => within(r).queryByText(n))!;
    expect(within(rowFor("101")).getByText("Available")).toBeInTheDocument();
    expect(within(rowFor("102")).getByText("In use")).toBeInTheDocument();
  });

  it.each([
    ["occupied", "Occupied"],
    ["maintenance", "Maintenance"],
    ["offline", "Offline"],
  ])("shows the catalogue status %s as %s", async (status, label) => {
    withRoomAndBooking({ status }, []);
    await renderPage();
    expect(within(roomsTable()).getByText(label)).toBeInTheDocument();
  });

  it("leaves a maintenance room as Maintenance even if booked", async () => {
    // Only "available" flips to In use; a room out for maintenance
    // should keep saying so rather than looking like normal occupancy.
    withRoomAndBooking({ status: "maintenance" }, [
      booking({ id: "b-1", room_id: "r-1" }),
    ]);
    await renderPage();
    expect(within(roomsTable()).getByText("Maintenance")).toBeInTheDocument();
    expect(within(roomsTable()).queryByText("In use")).not.toBeInTheDocument();
  });
});

describe("cost per night", () => {
  it.each([
    [null, "—"],
    [0, "—"],
    ["0", "—"],
    [125, "$125.00"],
    ["125.5", "$125.50"],
    ["not-a-number", "—"],
  ])("renders %s as %s", async (cost, expected) => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1", cost_per_night: cost as never })],
    });
    await renderPage();
    const row = within(roomsTable()).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[5]).toHaveTextContent(expected);
  });
});

describe("amenities", () => {
  it("lists only the flags that are set", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1", has_wifi: true, has_laundry: true })],
    });
    await renderPage();
    const cell = within(roomsTable()).getAllByRole("row")[1];
    expect(within(cell).getByText("Wi-Fi")).toBeInTheDocument();
    expect(within(cell).getByText("Laundry")).toBeInTheDocument();
    expect(within(cell).queryByText("Kitchen")).not.toBeInTheDocument();
  });

  it("appends free-text amenities alongside the flags", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1", has_wifi: true, amenities: "Sauna" })],
    });
    await renderPage();
    expect(within(roomsTable()).getByText(/Sauna/)).toBeInTheDocument();
  });

  it("shows free-text amenities even with no flags set", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1", amenities: "Sauna" })],
    });
    await renderPage();
    expect(within(roomsTable()).getByText(/Sauna/)).toBeInTheDocument();
  });

  it("dashes a room with nothing at all", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1" })],
    });
    await renderPage();
    const row = within(roomsTable()).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[4]).toHaveTextContent("—");
  });
});

describe("bookings list", () => {
  it("is omitted entirely when there are none", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1" })],
    });
    await renderPage();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Bookings" }),
    ).not.toBeInTheDocument();
  });

  it("orders by check-in date", async () => {
    getHousingUnit.mockResolvedValueOnce({ unit: unit(), rooms: [] });
    listHousingBookings.mockResolvedValueOnce({
      items: [
        booking({ id: "b-1", check_in: "2026-08-20", employee_name: "Later" }),
        booking({ id: "b-2", check_in: "2026-08-16", employee_name: "Sooner" }),
      ],
    });
    await renderPage();
    const names = within(bookingsTable())
      .getAllByRole("row")
      .slice(1)
      .map((r) => within(r).getAllByRole("cell")[1].textContent);
    expect(names).toEqual(["Sooner", "Later"]);
  });

  it("prefers the room record's number over the booking's copy", async () => {
    // The booking carries a denormalised room_number; if the room has
    // since been renumbered the room record is the truthful one.
    getHousingUnit.mockResolvedValueOnce({
      unit: unit(),
      rooms: [room({ id: "r-1", room_number: "201-renamed" })],
    });
    listHousingBookings.mockResolvedValueOnce({
      items: [booking({ id: "b-1", room_id: "r-1", room_number: "101-stale" })],
    });
    await renderPage();
    const row = within(bookingsTable()).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[0]).toHaveTextContent("201-renamed");
  });

  it("falls back to the booking's room number when the room is gone", async () => {
    getHousingUnit.mockResolvedValueOnce({ unit: unit(), rooms: [] });
    listHousingBookings.mockResolvedValueOnce({
      items: [booking({ id: "b-1", room_id: "r-missing", room_number: "101" })],
    });
    await renderPage();
    const row = within(bookingsTable()).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[0]).toHaveTextContent("101");
  });

  it("dashes the room when neither source has a number", async () => {
    getHousingUnit.mockResolvedValueOnce({ unit: unit(), rooms: [] });
    listHousingBookings.mockResolvedValueOnce({
      items: [booking({ id: "b-1", room_id: "r-missing", room_number: null })],
    });
    await renderPage();
    const row = within(bookingsTable()).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[0]).toHaveTextContent("—");
  });

  it("falls back to the user id when the employee has no name", async () => {
    // Better than a blank cell: the id is still traceable to a person.
    getHousingUnit.mockResolvedValueOnce({ unit: unit(), rooms: [] });
    listHousingBookings.mockResolvedValueOnce({
      items: [
        booking({ id: "b-1", employee_name: null, employee_user_id: "e-77" }),
      ],
    });
    await renderPage();
    expect(within(bookingsTable()).getByText("e-77")).toBeInTheDocument();
  });

  it("marks a cancelled booking as cancelled", async () => {
    getHousingUnit.mockResolvedValueOnce({ unit: unit(), rooms: [] });
    listHousingBookings.mockResolvedValueOnce({
      items: [
        booking({ id: "b-1", is_cancelled: true }),
        booking({ id: "b-2", check_in: "2026-08-20", is_cancelled: false }),
      ],
    });
    await renderPage();
    expect(within(bookingsTable()).getByText("Cancelled")).toBeInTheDocument();
    expect(within(bookingsTable()).getByText("Active")).toBeInTheDocument();
  });

  it("dashes an open-ended checkout and an absent purpose", async () => {
    getHousingUnit.mockResolvedValueOnce({ unit: unit(), rooms: [] });
    listHousingBookings.mockResolvedValueOnce({
      items: [booking({ id: "b-1", check_out: null, purpose: null })],
    });
    await renderPage();
    const row = within(bookingsTable()).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[3]).toHaveTextContent("—");
    expect(within(row).getAllByRole("cell")[4]).toHaveTextContent("—");
  });
});

describe("unit header", () => {
  it("flags an inactive unit", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit({ is_active: false }),
      rooms: [],
    });
    await renderPage();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows contact details when either field is present", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit({ contact_person: null, contact_phone: "907-555-0100" }),
      rooms: [],
    });
    await renderPage();
    expect(screen.getByText(/907-555-0100/)).toBeInTheDocument();
  });

  it("renders notes only when the unit has them", async () => {
    getHousingUnit.mockResolvedValueOnce({
      unit: unit({ notes: "Boiler serviced annually" }),
      rooms: [],
    });
    const { unmount } = await renderPage();
    expect(screen.getByText("Boiler serviced annually")).toBeInTheDocument();
    unmount();

    await renderPage();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });

  it("hands the add-room drawer this unit's id", async () => {
    await renderPage();
    expect(screen.getByTestId("add-room")).toHaveAttribute("data-unit-id", UNIT_ID);
  });
});
