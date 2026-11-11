import { describe, expect, it } from "vitest";

import { splitRetired } from "./retired";

const FLEET = [
  { id: "a-1", tail_number: "N100PA", is_active: true },
  { id: "a-2", tail_number: "N402PA", is_active: false },
  { id: "a-3", tail_number: "N301PA", is_active: false, grounded_reason: null },
  { id: "a-4", tail_number: "N705PA", is_active: false, grounded_reason: "mel_expired" },
];
const item = (id: string, aircraft: string) => ({ id, aircraft: { id: aircraft } });

describe("splitRetired (1110-16)", () => {
  it("keeps a retired aircraft's items out of the fleet's and names the tails", () => {
    const out = splitRetired([item("m-1", "a-1"), item("m-2", "a-2"), item("m-3", "a-3"), item("m-4", "a-2")], FLEET, null);
    expect(out.current.map((i) => i.id)).toEqual(["m-1"]);
    expect(out.retired.map((i) => i.id)).toEqual(["m-2", "m-3", "m-4"]);
    expect(out.tails).toEqual(["N301PA", "N402PA"]);
  });

  it("keeps a grounded aircraft's items with the fleet's: they are what grounds it", () => {
    const out = splitRetired([item("m-5", "a-4")], FLEET, null);
    expect(out.current.map((i) => i.id)).toEqual(["m-5"]);
    expect(out.retired).toEqual([]);
  });

  it("shows one aircraft's items as they are when the list is filtered to it", () => {
    const out = splitRetired([item("m-2", "a-2")], FLEET, "a-2");
    expect(out.current.map((i) => i.id)).toEqual(["m-2"]);
    expect(out.retired).toEqual([]);
  });

  it("leaves an aircraft the fleet list doesn't know with the fleet's items", () => {
    expect(splitRetired([item("m-9", "a-9")], FLEET, null).current).toHaveLength(1);
  });
});
