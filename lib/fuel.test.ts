import { describe, expect, it } from "vitest";

import type { FuelSupplierBaseResponse } from "@/lib/api/types";

import { fuelTypeForAircraft, supplierOptionsFor } from "./fuel";

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
