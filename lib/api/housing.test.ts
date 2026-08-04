import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import {
  addHousingRoom,
  cancelHousingBooking,
  createHousingBooking,
  createHousingUnit,
  deactivateHousingUnit,
  getHousingUnit,
  listHousingBookings,
  listHousingUnits,
  updateHousingUnit,
} from "./housing";

const mockedApiFetch = vi.mocked(apiFetch);

describe("housing API client", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  // ---- Units -------------------------------------------------------------

  it("listHousingUnits omits query string by default", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    await listHousingUnits();
    expect(mockedApiFetch).toHaveBeenCalledWith("/housing/units");
  });

  it("listHousingUnits appends include_inactive=true when asked", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    await listHousingUnits({ includeInactive: true });
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/housing/units?include_inactive=true",
    );
  });

  it("getHousingUnit hits the detail path", async () => {
    mockedApiFetch.mockResolvedValueOnce({ unit: {}, rooms: [] });
    await getHousingUnit("unit-42");
    expect(mockedApiFetch).toHaveBeenCalledWith("/housing/units/unit-42");
  });

  it("createHousingUnit POSTs the payload JSON", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "u1" });
    await createHousingUnit({
      name: "Emmonak Crew House",
      station: "PAEM",
    });
    expect(mockedApiFetch).toHaveBeenCalledWith("/housing/units", {
      method: "POST",
      body: JSON.stringify({
        name: "Emmonak Crew House",
        station: "PAEM",
      }),
    });
  });

  it("updateHousingUnit PATCHes only supplied fields", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "u1" });
    await updateHousingUnit("u1", { is_active: false });
    expect(mockedApiFetch).toHaveBeenCalledWith("/housing/units/u1", {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });
  });

  it("deactivateHousingUnit issues DELETE", async () => {
    mockedApiFetch.mockResolvedValueOnce(undefined);
    await deactivateHousingUnit("u1");
    expect(mockedApiFetch).toHaveBeenCalledWith("/housing/units/u1", {
      method: "DELETE",
    });
  });

  // ---- Rooms -------------------------------------------------------------

  it("addHousingRoom scopes to a specific unit", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "r1" });
    await addHousingRoom("u1", { room_number: "101", capacity: 2 });
    expect(mockedApiFetch).toHaveBeenCalledWith("/housing/units/u1/rooms", {
      method: "POST",
      body: JSON.stringify({ room_number: "101", capacity: 2 }),
    });
  });

  // ---- Bookings ----------------------------------------------------------

  it("listHousingBookings composes date range + filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    await listHousingBookings({
      from: "2026-08-01",
      to: "2026-08-31",
      roomId: "r1",
      employeeId: "e1",
      includeCancelled: true,
    });
    // URLSearchParams preserves insertion order; assert on the params.
    const call = mockedApiFetch.mock.calls[0][0] as string;
    expect(call.startsWith("/housing/bookings?")).toBe(true);
    const qs = new URLSearchParams(call.split("?")[1]);
    expect(qs.get("from")).toBe("2026-08-01");
    expect(qs.get("to")).toBe("2026-08-31");
    expect(qs.get("room_id")).toBe("r1");
    expect(qs.get("employee_id")).toBe("e1");
    expect(qs.get("include_cancelled")).toBe("true");
  });

  it("listHousingBookings omits query string when no filters", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [] });
    await listHousingBookings();
    expect(mockedApiFetch).toHaveBeenCalledWith("/housing/bookings");
  });

  it("createHousingBooking POSTs the payload JSON", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "b1" });
    await createHousingBooking({
      room_id: "r1",
      employee_user_id: "e1",
      check_in: "2026-08-05",
      check_out: "2026-08-09",
      purpose: "rotation",
    });
    expect(mockedApiFetch).toHaveBeenCalledWith("/housing/bookings", {
      method: "POST",
      body: JSON.stringify({
        room_id: "r1",
        employee_user_id: "e1",
        check_in: "2026-08-05",
        check_out: "2026-08-09",
        purpose: "rotation",
      }),
    });
  });

  it("cancelHousingBooking hits the cancel subpath", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "b1", is_cancelled: true });
    await cancelHousingBooking("b1");
    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/housing/bookings/b1/cancel",
      { method: "POST" },
    );
  });
});
