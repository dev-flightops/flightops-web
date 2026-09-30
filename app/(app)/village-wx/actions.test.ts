import { describe, expect, it, vi } from "vitest";

const { TestApiError, createVillageAirport, createVillageWeatherReport } = vi.hoisted(() => {
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
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/weather", () => ({ createVillageAirport, createVillageWeatherReport }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addVillageAirportAction, fileVillageReportAction } from "./actions";

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
