import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));

import { getFratThresholds, setFratThresholds } from "./auth";
import { apiFetch } from "./client";
import { getFratPrefill } from "./ops";

const mockedApiFetch = vi.mocked(apiFetch);

/**
 * These pin the WIRE, not the type.
 *
 * `vfr_min_visibility_sm` is a `Decimal` on the backend, so it arrives
 * as the JSON string `"3.0"` while every TypeScript type here declares
 * it `number`. Every existing fixture encoded the type, which is why
 * nothing caught the FRAT policy screen becoming unsaveable:
 * `Number.isFinite("3.0")` is false, so the Chief Pilot was told the
 * visibility floor had to be between 0 and 10 miles — about a value
 * of 3.
 *
 * The casts below are the point of the test. Remove them and it passes
 * whether or not the coercion exists.
 */
const WIRE_CONFIG = {
  id: "cfg",
  medium_entry_score: 15,
  high_entry_score: 25,
  extreme_entry_score: 35,
  adopted_at: null,
  adopted_by_name: null,
  rationale: null,
  max_total_score: 90,
  default_medium_entry_score: 15,
  default_high_entry_score: 25,
  default_extreme_entry_score: 35,
  crosswind_single_engine_kt: 30,
  crosswind_multi_engine_kt: 35,
  crosswind_near_margin_kt: 10,
  vfr_min_ceiling_ft: 1000,
  // As Pydantic sends them.
  vfr_min_visibility_sm: "3.0",
  default_vfr_min_visibility_sm: "3.0",
  default_crosswind_single_engine_kt: 30,
  default_crosswind_multi_engine_kt: 35,
  default_crosswind_near_margin_kt: 10,
  default_vfr_min_ceiling_ft: 1000,
  block_validity_hours: 4,
  default_block_validity_hours: 4,
};

describe("FRAT decimal fields at the client boundary", () => {
  it("reads the threshold config's visibility floor as a number", async () => {
    mockedApiFetch.mockResolvedValueOnce(WIRE_CONFIG);
    const config = await getFratThresholds();
    expect(config.vfr_min_visibility_sm).toBe(3);
    expect(typeof config.vfr_min_visibility_sm).toBe("number");
  });

  it("coerces the shipped default too", async () => {
    // The adoption notice compares the two. A string against a number
    // is never equal, so the screen would claim the operator had
    // departed from our defaults while sitting exactly on them.
    mockedApiFetch.mockResolvedValueOnce(WIRE_CONFIG);
    const config = await getFratThresholds();
    expect(config.default_vfr_min_visibility_sm).toBe(3);
    expect(config.vfr_min_visibility_sm).toBe(
      config.default_vfr_min_visibility_sm,
    );
  });

  it("coerces what comes back from a save, not only a read", async () => {
    // The PUT returns the same shape, and its response is what
    // router.refresh() renders next.
    mockedApiFetch.mockResolvedValueOnce(WIRE_CONFIG);
    const saved = await setFratThresholds({
      medium_entry_score: 15,
      high_entry_score: 25,
      extreme_entry_score: 35,
      crosswind_single_engine_kt: 30,
      crosswind_multi_engine_kt: 35,
      crosswind_near_margin_kt: 10,
      vfr_min_ceiling_ft: 1000,
      vfr_min_visibility_sm: 3,
      block_validity_hours: 4,
    });
    expect(saved.vfr_min_visibility_sm).toBe(3);
  });

  it("coerces the prefill's copy of the floor", async () => {
    // ops-service returns the same limit on the prefill so step 4 can
    // show what the wind was scored against.
    mockedApiFetch.mockResolvedValueOnce({
      flight_id: "f-1",
      suggestions: [],
      crosswind_limit_kt: 30,
      near_limit_entry_kt: 20,
      vfr_min_ceiling_ft: 1000,
      vfr_min_visibility_sm: "3.0",
    });
    const prefill = await getFratPrefill("f-1", {
      observations: [],
      is_ifr: false,
    });
    expect(prefill.vfr_min_visibility_sm).toBe(3);
  });
});
