import { beforeEach, expect, it, vi } from "vitest";

const { listFlights, listAircraft, listBookings, listCustomers } = vi.hoisted(() => ({
  listFlights: vi.fn(),
  listAircraft: vi.fn(),
  listBookings: vi.fn(),
  listCustomers: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/ops", () => ({ listAircraft, listFlights }));
vi.mock("@/lib/api/reservations", () => ({ listBookings, listCustomers }));
vi.mock("@/lib/api/auth", () => ({
  loadZoneTable: vi.fn(async () => ({ byIcao: {}, fallback: "America/Anchorage" })),
}));

import { spotlightSearch } from "./spotlight-search-action";

beforeEach(() => {
  vi.clearAllMocks();
  listAircraft.mockResolvedValue({ items: [] });
  listBookings.mockResolvedValue({ items: [] });
  listCustomers.mockResolvedValue({ items: [] });
});

it("asks the server for flights, nearest to now first (#168)", async () => {
  // It read the oldest 100 flights on file and looked through those, so a
  // flight today wasn't found once there were more than 100.
  listFlights.mockResolvedValue({
    items: [
      {
        id: "f-1",
        flight_number: "GV101",
        origin: "PANC",
        destination: "PABE",
        scheduled_departure_at: "2026-11-05T20:00:00Z",
        aircraft: { tail_number: "N100PA" },
      },
    ],
  });

  const groups = await spotlightSearch("GV1");

  expect(listFlights).toHaveBeenCalledWith({ q: "gv1", order: "nearest", limit: 5 });
  const flights = groups.find((g) => g.key === "flights");
  expect(flights?.items.map((hit) => hit.label)).toEqual(["GV101 · PANC → PABE"]);
});

it("dates an evening departure on the Alaska day, not the UTC one (1119-22)", async () => {
  // 19:30 AKST on Nov 19 is 04:30Z on Nov 20; the server's own zone is UTC.
  listFlights.mockResolvedValue({
    items: [
      {
        id: "f-2",
        flight_number: "GV202",
        origin: "PABE",
        destination: "PAEM",
        scheduled_departure_at: "2026-11-20T04:30:00Z",
        aircraft: { tail_number: "N100PA" },
      },
    ],
  });
  listBookings.mockResolvedValue({
    items: [
      {
        id: "b-2-0000-0000",
        origin_icao: "PABE",
        destination_icao: "PAEM",
        requested_departure_at: "2026-11-20T04:30:00Z",
        customer: { full_name: "Ella Evening", company_name: null },
      },
    ],
  });

  const groups = await spotlightSearch("PAEM");

  const flights = groups.find((g) => g.key === "flights");
  expect(flights?.items.map((hit) => hit.sublabel)).toEqual(["N100PA · Nov 19, 2026"]);
  const bookings = groups.find((g) => g.key === "bookings");
  expect(bookings?.items.map((hit) => hit.sublabel)).toEqual(["Ella Evening · Nov 19, 2026"]);
});

it("names every stop of a round trip, not PABE → PABE (audit, 26 Nov)", async () => {
  listFlights.mockResolvedValue({
    items: [
      {
        id: "f-2",
        flight_number: "PGR802",
        origin: "PABE",
        destination: "PABE",
        stops: ["PABE", "PAHP", "PAVA", "PABE"],
        scheduled_departure_at: "2026-11-25T19:30:00Z",
        aircraft: { tail_number: "N503PA" },
      },
    ],
  });
  const groups = await spotlightSearch("PGR8");
  const flights = groups.find((g) => g.key === "flights");
  expect(flights?.items.map((hit) => hit.label)).toEqual(["PGR802 · PABE → PAHP → PAVA → PABE"]);
});
