import { describe, expect, it } from "vitest";

import { crewWeightNote } from "./crew-weight";

describe("crewWeightNote (#125)", () => {
  it("says the crew count at the weights on their records", () => {
    expect(crewWeightNote({ crew_basis: "standard", crew_count: 2, crew_estimated_for: [] })).toBe(
      "2 assigned, at the weights on their records",
    );
  });

  it("names whoever was counted at the standard weight", () => {
    expect(
      crewWeightNote({ crew_basis: "standard", crew_count: 2, crew_estimated_for: ["Pat Pilot"] }),
    ).toBe("2 assigned; the standard weight for Pat Pilot, with no weight on file");
    expect(
      crewWeightNote({
        crew_basis: "standard",
        crew_count: 2,
        crew_estimated_for: ["Pat Pilot", "Sam Second"],
      }),
    ).toBe("2 assigned; the standard weight for Pat Pilot and Sam Second, with no weight on file");
  });

  it("keeps the manifest's, the empty flight's, and an older service's wording", () => {
    expect(crewWeightNote({ crew_basis: "manifest", crew_count: 1 })).toBe("as weighed on the manifest");
    expect(crewWeightNote({ crew_basis: "none", crew_count: 0 })).toBe("no crew on the flight yet");
    expect(crewWeightNote({ crew_basis: "standard", crew_count: 1 })).toBe("1 assigned, at standard weight");
  });
});
