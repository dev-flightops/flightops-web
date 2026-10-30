import { describe, expect, it, vi } from "vitest";

import type { FlightSearchResult } from "@/lib/api/flight-search";

const getFlightLoad = vi.fn();
vi.mock("@/lib/api/manifest", () => ({ getFlightLoad: (id: string) => getFlightLoad(id) }));

import { withPayloadLeft } from "./payload-left";
import { payloadLeftText } from "./payload-text";

const flight = (id: string) => ({ flight_id: id, flight_number: id.toUpperCase() }) as FlightSearchResult;

describe("what each flight can still carry (#153)", () => {
  it("takes ops' load, and leaves a flight it can't read without a figure", async () => {
    getFlightLoad.mockImplementation(async (id: string) => {
      if (id === "pgr791") return { load: { remaining_lbs: "1507.4" } };
      if (id === "n900aa") return { load: { remaining_lbs: null } };
      throw new Error("ops is down");
    });
    const items = await withPayloadLeft([flight("pgr791"), flight("n900aa"), flight("mm1122")]);
    expect(items.map((f) => f.payload_left_lbs)).toEqual([1507, null, null]);
  });

  it("words it as left, or over when it is already", () => {
    expect(payloadLeftText(1507)).toBe("1,507 lb left");
    expect(payloadLeftText(-261)).toBe("261 lb over");
  });
});
