import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBooking, getBookingChanges, searchFlights, loadZoneTable, getFleetAirworthiness } = vi.hoisted(() => ({
  getBooking: vi.fn(), getBookingChanges: vi.fn(), searchFlights: vi.fn(),
  loadZoneTable: vi.fn(), getFleetAirworthiness: vi.fn(),
}));
vi.mock("@/lib/api/reservations", () => ({
  getBooking, getBookingChanges, BOOKING_STATUS_LABELS: { requested: "Requested", cancelled: "Cancelled" },
  bookingRef: (id: string) => id,
}));
vi.mock("@/lib/api/flight-search", () => ({ searchFlights }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("@/lib/api/maintenance", () => ({ getFleetAirworthiness }));
vi.mock("./assign-flight-panel", () => ({ AssignFlightPanel: () => null }));
vi.mock("./booking-history", () => ({ BookingHistory: () => null }));
vi.mock("./edit-booking", () => ({ EditBooking: () => null }));
vi.mock("./lifecycle-controls", () => ({ LifecycleControls: () => null }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));

import BookingDetailPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  getBooking.mockResolvedValue({
    id: "booking-1", origin_icao: "PANC", destination_icao: "PABE",
    requested_departure_at: "2026-11-04T08:20:00Z", status: "requested",
    customer: { id: "customer-1", full_name: "UAT Journey" }, pax_count: 1,
    quoted_total_cents: null, created_at: "2026-11-04T08:00:00Z",
  });
  getBookingChanges.mockResolvedValue([]);
  getFleetAirworthiness.mockResolvedValue({ items: [] });
  searchFlights.mockResolvedValue({ items: [] });
  loadZoneTable.mockResolvedValue({ byIcao: { PANC: "America/Anchorage" }, fallback: "America/Anchorage" });
});

const page = () => BookingDetailPage({ params: Promise.resolve({ id: "booking-1" }), searchParams: Promise.resolve({}) });

describe("booking assignment searches the company operating day", () => {
  it("finds an Alaska evening flight although its UTC timestamp is tomorrow", async () => {
    await page();
    expect(searchFlights).toHaveBeenCalledWith({ origin: "PANC", destination: "PABE", date: "2026-11-03", paxCount: 1, showUnavailable: true });
    expect(loadZoneTable).toHaveBeenCalledTimes(1);
  });

  it("uses the company calendar that flight search accepts, even for another departure-base zone", async () => {
    loadZoneTable.mockResolvedValue({ byIcao: { PANC: "Pacific/Honolulu" }, fallback: "America/Anchorage" });
    getBooking.mockResolvedValue({ ...(await getBooking()), requested_departure_at: "2026-11-04T09:30:00Z" });
    await page();
    expect(searchFlights).toHaveBeenCalledWith(expect.objectContaining({ date: "2026-11-04" }));
  });

  it("does not offer assignment candidates for a cancelled booking", async () => {
    getBooking.mockResolvedValue({ ...(await getBooking()), status: "cancelled" });
    await page();
    expect(searchFlights).not.toHaveBeenCalled();
  });
});
