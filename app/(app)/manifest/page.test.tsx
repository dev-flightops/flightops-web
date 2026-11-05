import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listFlights, loadZoneTable } = vi.hoisted(() => ({ listFlights: vi.fn(), loadZoneTable: vi.fn() }));
vi.mock("@/lib/api/ops", () => ({ listFlights }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
import FlightSchedulePage from "./page";

beforeEach(() => {
  loadZoneTable.mockResolvedValue({ byIcao: {}, fallback: "America/Anchorage" });
  listFlights.mockResolvedValue({ items: [{
    id: "round-trip", flight_number: "DEMO103", origin: "PANC", destination: "PANC",
    stops: ["PANC", "PABE", "PANC"], status: "released",
    scheduled_departure_at: "2026-11-04T08:14:00Z", scheduled_arrival_at: "2026-11-04T09:14:00Z",
    aircraft: { id: "aircraft-1", tail_number: "N93DM", model: "Caravan", seats: 9 },
  }], total: 1 });
  listFlights.mockClear();
});

it("keeps the village stop visible on a return flight in the manifest schedule", async () => {
  render(await FlightSchedulePage({ searchParams: Promise.resolve({ range: "all" }) }));
  expect(screen.getByRole("cell", { name: "PANC → PABE → PANC" })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "PANC → PANC" })).not.toBeInTheDocument();
});

describe("reads the range it shows (#168)", () => {
  // This read the oldest 200 flights on file and filtered them here, so with
  // more than that on file, today's and the upcoming ones were never read.
  const FROZEN = "2026-11-05T20:00:00Z";
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(FROZEN));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [undefined, { departsFrom: "2026-11-05" }],
    ["today", { onCompanyDate: "2026-11-05" }],
    ["past", { departsTo: "2026-11-04", order: "desc" }],
    ["all", { order: "nearest" }],
  ])("range %s", async (range, wanted) => {
    await FlightSchedulePage({ searchParams: Promise.resolve({ range }) });
    expect(listFlights.mock.calls[0][0]).toEqual({ status: undefined, limit: 200, ...wanted });
  });

  it("keeps the status filter on the range and on today's count", async () => {
    await FlightSchedulePage({ searchParams: Promise.resolve({ range: "upcoming", status: "scheduled" }) });
    expect(listFlights.mock.calls[0][0]).toMatchObject({ status: "scheduled", departsFrom: "2026-11-05" });
    expect(listFlights.mock.calls[1][0]).toMatchObject({ status: "scheduled", onCompanyDate: "2026-11-05" });
  });

  it("counts today's flights and those in the air from their own lists, and says when it shows only some", async () => {
    const flight = (id: string, more = {}) => ({
      id, flight_number: id, origin: "PANC", destination: "PABE", status: "released",
      scheduled_departure_at: "2026-11-05T20:00:00Z", scheduled_arrival_at: "2026-11-05T21:00:00Z",
      aircraft: { id: "aircraft-1", tail_number: "N93DM", model: "Caravan", seats: 9 },
      ...more,
    });
    listFlights
      .mockResolvedValueOnce({ items: [flight("GV1"), flight("GV2")], total: 350 })
      .mockResolvedValueOnce({ items: [flight("GV1")], total: 7 })
      .mockResolvedValueOnce({
        items: [flight("GV3"), flight("GV4"), flight("GV5", { actual_arrival_at: "2026-11-05T21:00:00Z" })],
        total: 3,
      });
    render(await FlightSchedulePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("2 of 350")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
