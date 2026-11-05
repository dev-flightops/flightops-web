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
