import { describe, expect, it } from "vitest";

import {
  classifyAirframe,
  familyDisplayName,
  fieldsForFamily,
} from "./trend-fields";

describe("classifyAirframe", () => {
  it("maps turbine airframes to 'turbine'", () => {
    expect(classifyAirframe("caravan")).toBe("turbine");
    expect(classifyAirframe("kingair")).toBe("turbine");
    expect(classifyAirframe("pilatus")).toBe("turbine");
  });

  it("maps Navajo to 'twin_piston' (manifold pressure field)", () => {
    expect(classifyAirframe("navajo")).toBe("twin_piston");
  });

  it("maps single-engine piston airframes to 'piston'", () => {
    expect(classifyAirframe("c207")).toBe("piston");
    expect(classifyAirframe("ga8")).toBe("piston");
    expect(classifyAirframe("c182")).toBe("piston");
  });

  it("normalizes case + whitespace", () => {
    expect(classifyAirframe("  CARAVAN  ")).toBe("turbine");
    expect(classifyAirframe("Navajo")).toBe("twin_piston");
  });

  it("falls back to 'unsupported' for unknown / null", () => {
    expect(classifyAirframe(null)).toBe("unsupported");
    expect(classifyAirframe(undefined)).toBe("unsupported");
    expect(classifyAirframe("")).toBe("unsupported");
    expect(classifyAirframe("helicopter")).toBe("unsupported");
  });
});

describe("fieldsForFamily", () => {
  it("turbine includes both Takeoff and Cruise groups", () => {
    const fields = fieldsForFamily("turbine");
    const groups = new Set(fields.map((f) => f.group));
    expect(groups.has("Takeoff")).toBe(true);
    expect(groups.has("Cruise")).toBe(true);
    expect(fields.some((f) => f.key === "itt_takeoff_c")).toBe(true);
    expect(fields.some((f) => f.key === "fuel_flow_pph")).toBe(true);
  });

  it("piston has RPM + CHT + EGT but no manifold press", () => {
    const fields = fieldsForFamily("piston");
    const keys = fields.map((f) => f.key);
    expect(keys).toContain("rpm");
    expect(keys).toContain("cht_f");
    expect(keys).toContain("egt_f");
    expect(keys).not.toContain("manifold_press");
  });

  it("twin_piston adds manifold_press to the piston set", () => {
    const fields = fieldsForFamily("twin_piston");
    const keys = fields.map((f) => f.key);
    expect(keys).toContain("rpm");
    expect(keys).toContain("manifold_press");
  });

  it("unsupported returns an empty list", () => {
    expect(fieldsForFamily("unsupported")).toEqual([]);
  });

  it("notes field is always the last entry (renders below numeric inputs)", () => {
    for (const family of ["turbine", "piston", "twin_piston"] as const) {
      const fields = fieldsForFamily(family);
      expect(fields[fields.length - 1].key).toBe("notes");
    }
  });
});

describe("familyDisplayName", () => {
  it("uses the brand name for known turbines", () => {
    expect(familyDisplayName("turbine", "caravan")).toMatch(/Caravan/);
    expect(familyDisplayName("turbine", "kingair")).toMatch(/King Air/);
    expect(familyDisplayName("turbine", "pilatus")).toMatch(/Pilatus/);
  });

  it("returns a generic label when family + slug don't pair up", () => {
    expect(familyDisplayName("turbine", null)).toBe("Turbine");
    expect(familyDisplayName("piston", "unknown")).toBe("Piston Engine");
  });

  it("uses Navajo's full name for twin_piston", () => {
    expect(familyDisplayName("twin_piston", "navajo")).toMatch(/Navajo/);
  });
});
