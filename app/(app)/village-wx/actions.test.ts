import { describe, expect, it, vi } from "vitest";

const {
  TestApiError,
  createVillageAirport,
  createVillageWeatherReport,
  updateVillageAirport,
  retireVillageAirport,
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
    createVillageAirport: vi.fn(),
    createVillageWeatherReport: vi.fn(),
    updateVillageAirport: vi.fn(),
    retireVillageAirport: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({
  createVillageAirport,
  createVillageWeatherReport,
  updateVillageAirport,
  retireVillageAirport,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addVillageAirportAction,
  editVillageAirportAction,
  fileVillageReportAction,
  retireVillageAirportAction,
} from "./actions";

const REPORTERS =
  "Only dispatchers, pilots, Ground Ops, reservations agents, the Chief Pilot, the Director of Operations or an Exec Admin can";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("village weather refused by role (29 Sep)", () => {
  it("filing a report says who can", async () => {
    createVillageWeatherReport.mockRejectedValueOnce(
      new TestApiError(403, "/weather/village/reports", "insufficient_role"),
    );
    expect(
      await fileVillageReportAction(
        { status: "idle" },
        form({ village_airport_id: "11111111-1111-1111-1111-111111111111" }),
      ),
    ).toEqual({ status: "api-error", message: `${REPORTERS} file the report.` });
  });

  it("adding an airport says who can", async () => {
    createVillageAirport.mockRejectedValueOnce(
      new TestApiError(403, "/weather/village/airports", "insufficient_role"),
    );
    expect(
      await addVillageAirportAction({ status: "idle" }, form({ icao: "PAKW", name: "Kwethluk" })),
    ).toEqual({ status: "api-error", message: `${REPORTERS} add the airport.` });
  });
});

describe("a filed report's photos (#121)", () => {
  it("answers with the report, so its photos can follow", async () => {
    createVillageWeatherReport.mockResolvedValueOnce({ id: "r-1" });
    expect(
      await fileVillageReportAction(
        { status: "idle" },
        form({ village_airport_id: "11111111-1111-1111-1111-111111111111" }),
      ),
    ).toEqual({ status: "ok", reportId: "r-1" });
  });
});

describe("correcting and retiring a village airport (#130)", () => {
  const LEVELOCK = { icao: " 9z8 ", name: "Levelock", region: "", notes: "" };

  it("sends the identifier as the board shows it", async () => {
    updateVillageAirport.mockResolvedValue({});
    expect(await editVillageAirportAction("a-9", LEVELOCK)).toEqual({ ok: true });
    expect(updateVillageAirport).toHaveBeenCalledWith("a-9", {
      icao: "9Z8",
      name: "Levelock",
      region: null,
      notes: null,
    });
  });

  it("marks the identifier another airport has", async () => {
    updateVillageAirport.mockRejectedValue(new TestApiError(409, "/x", "icao exists"));
    expect(await editVillageAirportAction("a-9", LEVELOCK)).toEqual({
      ok: false,
      error: "Check the fields marked.",
      errors: { icao: "Another airport, a retired one included, has that identifier." },
    });
  });

  it("marks a blank name before asking the service", async () => {
    updateVillageAirport.mockClear();
    const result = await editVillageAirportAction("a-9", { ...LEVELOCK, name: " " });
    expect(result).toMatchObject({ ok: false, errors: { name: "Name is required" } });
    expect(updateVillageAirport).not.toHaveBeenCalled();
  });

  it("retires, and says who can when refused", async () => {
    retireVillageAirport.mockResolvedValueOnce(undefined);
    expect(await retireVillageAirportAction("a-9")).toEqual({ ok: true });
    retireVillageAirport.mockRejectedValueOnce(new TestApiError(403, "/x", "insufficient_role"));
    const refused = await retireVillageAirportAction("a-9");
    expect(refused).toMatchObject({ ok: false });
    expect(refused.ok ? "" : refused.error).toContain(REPORTERS);
  });
});
