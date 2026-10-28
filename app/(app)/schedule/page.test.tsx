import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightListItem } from "@/lib/api/types";

const { TestApiError, listFlights, listAircraft, getFleetAirworthiness } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listFlights: vi.fn(), listAircraft: vi.fn(), getFleetAirworthiness: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ listFlights, listAircraft }));
vi.mock("@/lib/api/maintenance", () => ({ getFleetAirworthiness }));

// DatePicker + StatusFilter are client components using useTransition +
// useRouter; jsdom doesn't mount the router. Stub as passive markers.
vi.mock("./date-picker", () => ({
  DatePicker: ({ defaultValue }: { defaultValue: string }) => (
    <span data-testid="date-picker">{defaultValue}</span>
  ),
}));
vi.mock("./status-filter", () => ({
  StatusFilter: () => <div data-testid="status-filter" />,
}));

import SchedulePage from "./page";

function makeFlight(overrides: Partial<FlightListItem>): FlightListItem {
  return {
    id: "f-1",
    flight_number: "GV101",
    origin: "PANC",
    destination: "PABE",
    scheduled_departure_at: "2026-06-15T14:00:00Z",
    scheduled_arrival_at: "2026-06-15T15:30:00Z",
    status: "scheduled",
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "Cessna 208 Caravan",
      seats: 9,
    },
    actual_departure_at: null,
    actual_arrival_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  listFlights.mockReset();
  listAircraft.mockReset().mockResolvedValue({ items: [], total: 0 });
  getFleetAirworthiness.mockReset().mockResolvedValue({ items: [], total: 0 });
});

async function renderPage(
  searchParams: { date?: string; statuses?: string; view?: string } = {},
) {
  const ui = await SchedulePage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

/** The list (M2-G-30), one click from the default view since #139. */
const renderList = (searchParams: { date?: string; statuses?: string } = {}) => renderPage({ ...searchParams, view: "list" });

describe("SchedulePage (M2-G-30)", () => {
  it("renders title + per-date subtitle", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderList({ date: "2026-06-15" });

    expect(
      screen.getByRole("heading", { name: /flight schedule/i, level: 1 }),
    ).toBeInTheDocument();
    // "2026-06-15" appears in the subtitle + the DatePicker stub
    expect(screen.getAllByText(/2026-06-15/).length).toBeGreaterThanOrEqual(1);
  });

  it("fetches with the date param", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderList({ date: "2026-07-01" });

    // The company's day (#137), not a UTC one.
    expect(listFlights).toHaveBeenCalledWith({
      onCompanyDate: "2026-07-01",
      limit: 200,
      withSeats: false,
    });
  });

  it("ignores malformed date params", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderList({ date: "not-a-date" });

    // falls back to today in the company's zone (#137)
    expect(listFlights).toHaveBeenCalledWith({
      onCompanyDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      limit: 200,
      withSeats: false,
    });
  });

  it("groups flights by origin base, sorted by ETD within each group", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          id: "a",
          flight_number: "GV200",
          origin: "PABE",
          scheduled_departure_at: "2026-06-15T16:00:00Z",
        }),
        makeFlight({
          id: "b",
          flight_number: "GV100",
          origin: "PANC",
          scheduled_departure_at: "2026-06-15T13:00:00Z",
        }),
        makeFlight({
          id: "c",
          flight_number: "GV110",
          origin: "PANC",
          scheduled_departure_at: "2026-06-15T14:30:00Z",
        }),
      ],
      total: 3,
    });

    await renderList();

    expect(
      screen.getByRole("heading", { name: /PANC/, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /PABE/, level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("GV100")).toBeInTheDocument();
    expect(screen.getByText("GV110")).toBeInTheDocument();
    expect(screen.getByText("GV200")).toBeInTheDocument();
  });

  it("filters by status when statuses param is set", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({ id: "a", flight_number: "GV100", status: "released" }),
        makeFlight({ id: "b", flight_number: "GV200", status: "scheduled" }),
      ],
      total: 2,
    });

    await renderList({ statuses: "released" });

    expect(screen.getByText("GV100")).toBeInTheDocument();
    expect(screen.queryByText("GV200")).not.toBeInTheDocument();
  });

  it("renders per-row Print link to the manifest page", async () => {
    listFlights.mockResolvedValueOnce({
      items: [makeFlight({ id: "f-42" })],
      total: 1,
    });

    await renderList();

    const printLink = screen.getByRole("link", { name: /print/i });
    expect(printLink).toHaveAttribute("href", "/schedule/f-42/manifest");
    expect(printLink).toHaveAttribute("target", "_blank");
  });

  it("renders the empty state when no flights are scheduled", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });

    await renderList({ date: "2026-06-15" });

    expect(
      screen.getByText(/no flights scheduled for 2026-06-15/i),
    ).toBeInTheDocument();
  });

  it("renders distinct copy when filters trim everything to zero", async () => {
    listFlights.mockResolvedValueOnce({
      items: [makeFlight({ status: "scheduled" })],
      total: 1,
    });

    await renderList({ statuses: "completed" });

    expect(
      screen.getByText(/no flights match the current status filter/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired alert on 401", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(401, "/ops/flights", "Unauthorized"),
    );

    await renderList();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error alert on 5xx", async () => {
    listFlights.mockRejectedValueOnce(
      new TestApiError(502, "/ops/flights", "Bad Gateway"),
    );

    await renderList();

    expect(screen.getByText(/schedule feed unavailable/i)).toBeInTheDocument();
  });
});

/** #139: by default the day is a column per aircraft, a block per leg. */
describe("the schedule by aircraft (#139)", () => {
  const legs = [
    { sequence: 1, origin: "PABE", destination: "9Z8", scheduled_departure_at: "2026-10-30T18:30:00Z", scheduled_arrival_at: "2026-10-30T19:45:00Z" },
    { sequence: 2, origin: "9Z8", destination: "PABE", scheduled_departure_at: "2026-10-30T20:00:00Z", scheduled_arrival_at: "2026-10-30T21:15:00Z" },
  ];

  it("is the default, asking for the seats on each leg", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });
    await renderPage({ date: "2026-10-30" });
    expect(listFlights).toHaveBeenCalledWith({ onCompanyDate: "2026-10-30", limit: 200, withSeats: true });
    expect(screen.getByRole("region", { name: "Flights by aircraft" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "By aircraft" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute("href", "/schedule?date=2026-10-30&view=list");
  });

  it("shows every aircraft that can fly or is grounded, and each leg on its aircraft", async () => {
    listFlights.mockResolvedValueOnce({
      items: [
        makeFlight({
          id: "f-790",
          flight_number: "PGR790",
          origin: "PABE",
          destination: "PABE",
          scheduled_departure_at: "2026-10-30T18:30:00Z",
          scheduled_arrival_at: "2026-10-30T21:15:00Z",
          aircraft: { id: "ac-100", tail_number: "N100PA", model: "Cessna 208 Caravan", seats: 9 },
          stops: ["PABE", "9Z8", "PABE"],
          legs,
          seats_held_by_leg: [5, 0],
        }),
      ],
      total: 1,
    });
    listAircraft.mockResolvedValueOnce({
      items: [
        { id: "ac-100", tail_number: "N100PA", model: "Cessna 208 Caravan", seats: 9, is_active: true },
        { id: "ac-503", tail_number: "N503PA", model: "Cessna 208B", seats: 9, is_active: true },
        { id: "ac-301", tail_number: "N301PA", model: "Cessna 207", seats: 6, is_active: false },
        { id: "ac-999", tail_number: "N999PA", model: "Stored", seats: 4, is_active: false },
      ],
      total: 4,
    });
    getFleetAirworthiness.mockResolvedValueOnce({
      items: [{ aircraft: { id: "ac-301", tail_number: "N301PA", model: "Cessna 207" }, is_active: false, is_airworthy: false, grounded_reason: "mel_expired" }],
      total: 1,
    });
    await renderPage({ date: "2026-10-30" });
    const day = screen.getByRole("region", { name: "Flights by aircraft" });
    expect(within(day).getAllByRole("group").map((g) => g.getAttribute("aria-label"))).toEqual([
      "N100PA",
      "N301PA, grounded: MEL expired",
      "N503PA",
    ]);
    expect(within(screen.getByRole("group", { name: "N100PA" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "PGR790.1, PABE to 9Z8, 10:30–11:45, Planned, 5 of 9 seats booked",
      "PGR790.2, 9Z8 to PABE, 12:00–13:15, Planned, 0 of 9 seats booked",
    ]);
  });

  it("still shows the day when maintenance's view of the fleet doesn't load", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });
    listAircraft.mockResolvedValueOnce({ items: [{ id: "ac-100", tail_number: "N100PA", model: null, seats: 9, is_active: true }], total: 1 });
    getFleetAirworthiness.mockRejectedValueOnce(new TestApiError(502, "/maintenance/airworthiness/fleet", "Bad Gateway"));
    await renderPage({ date: "2026-10-30" });
    expect(screen.getByRole("group", { name: "N100PA" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load which aircraft are grounded.");
    expect(screen.getByText(/No flights scheduled for 2026-10-30/)).toBeInTheDocument();
  });

  it("leaves a role that can't read maintenance without a grounded reason, and says nothing", async () => {
    listFlights.mockResolvedValueOnce({ items: [], total: 0 });
    listAircraft.mockResolvedValueOnce({ items: [{ id: "ac-100", tail_number: "N100PA", model: null, seats: 9, is_active: true }], total: 1 });
    getFleetAirworthiness.mockRejectedValueOnce(new TestApiError(403, "/maintenance/airworthiness/fleet", "Forbidden"));
    await renderPage({ date: "2026-10-30" });
    expect(screen.getByRole("group", { name: "N100PA" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
