import { describe, expect, it } from "vitest";

import type {
  TypeCellState,
  TypeQualificationGrid,
} from "@/lib/api/type-qualifications";

import { typeWarnings } from "./type-warnings";

function grid(
  enforced: boolean,
  pilots: Record<string, Record<string, TypeCellState>>,
): TypeQualificationGrid {
  return {
    airframe_types: ["caravan", "c207"],
    positions: ["pic", "sic", "instructor", "check_airman", "advisory"],
    check_items: { competency: "c", instrument: "i" },
    enforced,
    pilots: Object.entries(pilots).map(([id, held]) => ({
      pilot: { id, full_name: id, email: `${id}@example.test` },
      station: "PANC",
      cells: ["caravan", "c207"].flatMap((t) =>
        (["pic", "sic"] as const).map((p) => ({
          airframe_type: t,
          position: p,
          state: held[`${t}/${p}`] ?? "not_authorised",
          qualification_id: null,
          authorised_on: null,
          checks: [],
        })),
      ),
    })),
  };
}

describe("typeWarnings", () => {
  it("names what is wrong in each seat on the flight's type", () => {
    const warnings = typeWarnings(
      grid(true, {
        ana: { "caravan/pic": "current", "caravan/sic": "current" },
        ben: { "caravan/sic": "grace", "caravan/pic": "non_current" },
        cy: {},
      }),
      " Caravan ",
    );
    // Current in both seats: nothing to say. A grace month still flies.
    expect(warnings.has("ana")).toBe(false);
    expect(warnings.get("ben")).toEqual({
      pic: "not current as PIC on CARAVAN",
      sic: null,
    });
    expect(warnings.get("cy")).toEqual({
      pic: "not authorised as PIC on CARAVAN",
      sic: "not authorised as SIC on CARAVAN",
    });
  });

  it("says nothing until the company enforces aircraft qualifications", () => {
    expect(typeWarnings(grid(false, { cy: {} }), "caravan").size).toBe(0);
  });

  it("says nothing without a grid or a type", () => {
    expect(typeWarnings(null, "caravan").size).toBe(0);
    expect(typeWarnings(grid(true, { cy: {} }), null).size).toBe(0);
  });

  it("treats a type the grid doesn't list as held by nobody", () => {
    expect(typeWarnings(grid(true, { cy: {} }), "navajo").get("cy")).toEqual({
      pic: "not authorised as PIC on NAVAJO",
      sic: "not authorised as SIC on NAVAJO",
    });
  });
});
