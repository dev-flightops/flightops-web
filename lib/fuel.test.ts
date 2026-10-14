import { describe, expect, it } from "vitest";

import type { FuelSupplierBaseResponse } from "@/lib/api/types";

import { fuelTypeForAircraft, localDate, neededByInstant, supplierOptionsFor } from "./fuel";

function row(over: Partial<FuelSupplierBaseResponse>): FuelSupplierBaseResponse {
  return {
    id: "sb-1",
    supplier_id: "s-1",
    supplier_name: "Arctic Fuel",
    base_code: "PANC",
    fuel_type_id: "ft-jet",
    fuel_type_code: "jet_a",
    fuel_type_label: "Jet A",
    price_per_gallon: 6,
    is_contract_rate: true,
    effective_from: null,
    effective_to: null,
    is_default: false,
    notes: null,
    is_active: true,
    ...over,
  };
}

describe("fuel for an aircraft", () => {
  it("follows legacy's split", () => {
    expect(fuelTypeForAircraft("Cessna 208B Grand Caravan")).toBe("JET-A");
    expect(fuelTypeForAircraft("Cessna 207 Skywagon")).toBe("100LL");
    expect(fuelTypeForAircraft("GippsAero GA8 Airvan")).toBe("100LL");
    expect(fuelTypeForAircraft(null)).toBe("JET-A");
  });

  it("finds a 207's avgas, which the packet's exact match never did", () => {
    const rows = [
      row({ id: "a", fuel_type_code: "av_gas_100ll", fuel_type_label: "100LL" }),
      row({ id: "b" }),
    ];
    expect(supplierOptionsFor(rows, "100LL").map((o) => o.key)).toEqual(["a"]);
    expect(supplierOptionsFor(rows, "JET-A").map((o) => o.key)).toEqual(["b"]);
  });

  it("offers the base's default supplier first", () => {
    const rows = [
      row({ id: "a", supplier_name: "Second" }),
      row({ id: "b", supplier_name: "Default", is_default: true }),
    ];
    expect(supplierOptionsFor(rows, "JET-A").map((o) => o.supplierName)).toEqual([
      "Default",
      "Second",
    ]);
  });
});

describe("neededByInstant", () => {
  // Local at the departure base (#68): 15:15 AKDT is 23:15Z.
  const ALASKA = "America/Anchorage";

  it("is on the departure's day when earlier than departure", () => {
    expect(neededByInstant("2026-09-28T23:15:00Z", "14:55", ALASKA).toISOString()).toBe(
      "2026-09-28T22:55:00.000Z",
    );
  });

  it("is the day before when later in the day than departure", () => {
    // A 06:00 AKDT departure; fuel "by 23:50" is the evening before.
    expect(neededByInstant("2026-09-29T14:00:00Z", "23:50", ALASKA).toISOString()).toBe(
      "2026-09-29T07:50:00.000Z",
    );
  });

  it("allows the departure minute itself", () => {
    expect(neededByInstant("2026-09-28T23:15:00Z", "15:15", ALASKA).toISOString()).toBe(
      "2026-09-28T23:15:00.000Z",
    );
  });

  it("crosses a month end", () => {
    // 06:00 AKDT on 1 October; "by 22:00" is 30 September's evening.
    expect(neededByInstant("2026-10-01T14:00:00Z", "22:00", ALASKA).toISOString()).toBe(
      "2026-10-01T06:00:00.000Z",
    );
  });

  it("is read in the zone given, not UTC", () => {
    // The client's GV2004: 11:30 AKDT is 19:30Z; fuel by 10:30 local.
    expect(neededByInstant("2026-10-11T19:30:00Z", "10:30", ALASKA).toISOString()).toBe(
      "2026-10-11T18:30:00.000Z",
    );
  });
});

describe("localDate", () => {
  it("is the departure base's calendar day", () => {
    // 18:45 AKDT on 11 October is already 12 October in UTC.
    expect(localDate("2026-10-12T02:45:00Z", "America/Anchorage")).toBe("2026-10-11");
  });
});
