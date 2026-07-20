import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  createBooking,
  createCustomer,
  getBooking,
  getCustomer,
  listBookings,
  listCustomers,
  quoteBooking,
  updateBooking,
  updateCustomer,
} from "./reservations";

const mockedApiFetch = vi.mocked(apiFetch);

describe("reservations API client", () => {
  // ---- Customers ---------------------------------------------------------

  it("listCustomers composes q + include_archived", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listCustomers({ q: "chena", include_archived: true, limit: 20 });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/reservations/customers?q=chena&include_archived=true&limit=20",
    );
  });

  it("listCustomers omits ? when no filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listCustomers();
    expect(mockedApiFetch).toHaveBeenCalledWith("/reservations/customers");
  });

  it("getCustomer interpolates the id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await getCustomer("c-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/reservations/customers/c-1");
  });

  it("createCustomer POSTs the body", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await createCustomer({ full_name: "Alice" });
    expect(mockedApiFetch).toHaveBeenCalledWith("/reservations/customers", {
      method: "POST",
      body: JSON.stringify({ full_name: "Alice" }),
    });
  });

  it("updateCustomer PATCHes to the specific id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await updateCustomer("c-1", { archived: true });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/reservations/customers/c-1",
      {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      },
    );
  });

  // ---- Bookings ----------------------------------------------------------

  it("listBookings composes date + status filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listBookings({
      from_date: "2026-07-20T00:00:00Z",
      to_date: "2026-08-01T00:00:00Z",
      status: "confirmed",
    });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/reservations/bookings?from_date=2026-07-20T00%3A00%3A00Z&to_date=2026-08-01T00%3A00%3A00Z&status=confirmed",
    );
  });

  it("getBooking interpolates the id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await getBooking("b-1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/reservations/bookings/b-1");
  });

  it("createBooking POSTs the body", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await createBooking({
      customer_id: "c-1",
      origin_icao: "PANC",
      destination_icao: "PABE",
      requested_departure_at: "2026-08-01T09:00:00Z",
      pax_count: 4,
    });
    expect(mockedApiFetch).toHaveBeenCalledWith("/reservations/bookings", {
      method: "POST",
      body: JSON.stringify({
        customer_id: "c-1",
        origin_icao: "PANC",
        destination_icao: "PABE",
        requested_departure_at: "2026-08-01T09:00:00Z",
        pax_count: 4,
      }),
    });
  });

  it("updateBooking PATCHes to the specific id", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await updateBooking("b-1", { pax_count: 5 });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/reservations/bookings/b-1",
      {
        method: "PATCH",
        body: JSON.stringify({ pax_count: 5 }),
      },
    );
  });

  it("quoteBooking POSTs quoted_total_cents", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await quoteBooking("b-1", 250_000);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/reservations/bookings/b-1/quote",
      {
        method: "POST",
        body: JSON.stringify({ quoted_total_cents: 250_000 }),
      },
    );
  });

  it("confirmBooking POSTs empty", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await confirmBooking("b-1");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/reservations/bookings/b-1/confirm",
      { method: "POST" },
    );
  });

  it("completeBooking POSTs empty", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await completeBooking("b-1");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/reservations/bookings/b-1/complete",
      { method: "POST" },
    );
  });

  it("cancelBooking sends the reason", async () => {
    mockedApiFetch.mockResolvedValueOnce({} as never);
    await cancelBooking("b-1", "Customer weather no-go.");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/reservations/bookings/b-1/cancel",
      {
        method: "POST",
        body: JSON.stringify({ reason: "Customer weather no-go." }),
      },
    );
  });
});
