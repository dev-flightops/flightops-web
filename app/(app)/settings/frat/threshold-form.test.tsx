import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import type { FratThresholdConfigResponse } from "@/lib/api/types";

import type { SaveThresholdsState } from "./actions";
import { ThresholdForm } from "./threshold-form";

/**
 * The three thresholds.
 *
 * What needs pinning is the ordering rule and the preview. No FAR sets
 * these numbers, so the operator is genuinely choosing them, and the
 * form's job is to make the consequence of a change visible before it
 * is saved.
 */

function config(over: Partial<FratThresholdConfigResponse> = {}) {
  return {
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
    // The operator's own company limits, which ship as the defaults.
    crosswind_single_engine_kt: 30,
    crosswind_multi_engine_kt: 35,
    crosswind_near_margin_kt: 10,
    vfr_min_ceiling_ft: 1000,
    vfr_min_visibility_sm: 3,
    default_crosswind_single_engine_kt: 30,
    default_crosswind_multi_engine_kt: 35,
    default_crosswind_near_margin_kt: 10,
    default_vfr_min_ceiling_ft: 1000,
    default_vfr_min_visibility_sm: 3,
    block_validity_hours: 4,
    default_block_validity_hours: 4,
    ...over,
  } satisfies FratThresholdConfigResponse;
}

function form(over: Partial<FratThresholdConfigResponse> = {}) {
  const action = vi.fn(
    async (): Promise<SaveThresholdsState> => ({ status: "saved" }),
  );
  render(<ThresholdForm config={config(over)} saveAction={action} />);
  return action;
}

const bandWidth = (key: string) =>
  parseFloat(screen.getByTestId(`band-${key}`).style.width);

describe("the preview", () => {
  it("draws the bands to scale against the reachable maximum", () => {
    // Not four equal blocks: on a 0–90 scale with EXTREME at 35, the
    // red band really is the widest, and that is worth seeing.
    form();
    expect(bandWidth("low")).toBeCloseTo((15 / 90) * 100, 1);
    expect(bandWidth("medium")).toBeCloseTo((10 / 90) * 100, 1);
    expect(bandWidth("high")).toBeCloseTo((10 / 90) * 100, 1);
    expect(bandWidth("extreme")).toBeCloseTo((55 / 90) * 100, 1);
  });

  it("labels each band with the scores it covers", () => {
    form();
    expect(screen.getByText("Low 0–14")).toBeInTheDocument();
    expect(screen.getByText("Medium 15–24")).toBeInTheDocument();
    expect(screen.getByText("High 25–34")).toBeInTheDocument();
    expect(screen.getByText("Extreme 35–90")).toBeInTheDocument();
  });

  it("redraws as a threshold is typed", async () => {
    const user = userEvent.setup();
    form();
    const before = bandWidth("extreme");
    const field = screen.getByLabelText(/Extreme starts at/i);
    await user.clear(field);
    await user.type(field, "28");
    expect(bandWidth("extreme")).toBeGreaterThan(before);
    expect(screen.getByText("Extreme 28–90")).toBeInTheDocument();
  });

  it("describes the bands for a screen reader", () => {
    // The bar is the only place the layout is visible, and it is four
    // coloured divs.
    form();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Low below 15, Medium 15 to 24, High 25 to 34, Extreme 35 and above, out of 90",
    );
  });
});

describe("the ordering rule", () => {
  it("refuses a band that starts at or above the next one", async () => {
    const user = userEvent.setup();
    form();
    const field = screen.getByLabelText(/High starts at/i);
    await user.clear(field);
    await user.type(field, "40");
    expect(
      screen.getByRole("button", { name: /FRAT policy/i }),
    ).toBeDisabled();
    expect(screen.getByText(/never fires/)).toBeInTheDocument();
  });

  it("refuses an Extreme band above the reachable maximum", async () => {
    // "EXTREME never triggers" is not a state to reach by typo.
    const user = userEvent.setup();
    form();
    const field = screen.getByLabelText(/Extreme starts at/i);
    await user.clear(field);
    await user.type(field, "95");
    expect(
      screen.getByRole("button", { name: /FRAT policy/i }),
    ).toBeDisabled();
  });

  it("hides the preview rather than drawing a nonsense bar", async () => {
    const user = userEvent.setup();
    form();
    const field = screen.getByLabelText(/High starts at/i);
    await user.clear(field);
    await user.type(field, "40");
    expect(screen.queryByTestId("band-low")).not.toBeInTheDocument();
  });
});

describe("saving", () => {
  it("sends the whole policy, not only what was touched", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async (): Promise<SaveThresholdsState> => ({ status: "saved" }),
    );
    render(<ThresholdForm config={config()} saveAction={action} />);

    const field = screen.getByLabelText(/Extreme starts at/i);
    await user.clear(field);
    await user.type(field, "30");
    await user.type(
      screen.getByLabelText(/Why these numbers/i),
      "Tightened after review.",
    );
    await user.click(screen.getByRole("button", { name: /FRAT policy/i }));

    expect(action).toHaveBeenCalledWith({
      medium: 15,
      high: 25,
      extreme: 30,
      // Untouched, so they arrive as the operator's shipped limits.
      crosswindSingleKt: 30,
      crosswindMultiKt: 35,
      nearMarginKt: 10,
      vfrMinCeilingFt: 1000,
      vfrMinVisibilitySm: 3,
      blockValidityHours: 4,
      rationale: "Tightened after review.",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(refresh).toHaveBeenCalled();
  });

  it("surfaces a refusal", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async (): Promise<SaveThresholdsState> => ({
        status: "error",
        message: "Only the Chief Pilot or the DO can set these.",
      }),
    );
    render(<ThresholdForm config={config()} saveAction={action} />);
    await user.click(screen.getByRole("button", { name: /FRAT policy/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only the Chief Pilot",
    );
  });
});

describe("adoption", () => {
  it("asks an operator who has never chosen to adopt", () => {
    form({ adopted_at: null });
    expect(
      screen.getByRole("button", { name: "Adopt this FRAT policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Saving unchanged still records/),
    ).toBeInTheDocument();
  });

  it("says save once somebody has", () => {
    form({ adopted_at: "2026-09-16T10:00:00Z", adopted_by_name: "S. Kessler" });
    expect(
      screen.getByRole("button", { name: "Save FRAT policy" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Saving unchanged still records/),
    ).not.toBeInTheDocument();
  });

  it("drops the prompt once a value is changed from the default", async () => {
    // It only makes sense while the values still are the defaults.
    const user = userEvent.setup();
    form({ adopted_at: null });
    const field = screen.getByLabelText(/Medium starts at/i);
    await user.clear(field);
    await user.type(field, "12");
    expect(
      screen.queryByText(/Saving unchanged still records/),
    ).not.toBeInTheDocument();
  });
});

/**
 * The company operating limits, added 22 Sep 2026.
 *
 * These are the numbers the operator gave when asked what "near the
 * aircraft crosswind limit" should mean, having first corrected the
 * premise: "demonstrated does not limit us... Our single engine x wind
 * limits are 30kts multi engines are 35kts. That's a company limit."
 */
describe("company operating limits", () => {
  it("shows where near and over fall, for both engine counts", () => {
    // The point of the readout: 30 and 10 are two numbers, and what
    // they mean together — near from 20, over above 30 — is the thing
    // a chief pilot is actually deciding.
    form();
    const readout = screen.getByText(/scores near the limit from/i);
    expect(readout).toHaveTextContent("20 kt");
    expect(readout).toHaveTextContent("30 kt");
    expect(readout).toHaveTextContent("25 kt");
    expect(readout).toHaveTextContent("35 kt");
  });

  it("moves the boundary when the margin changes", async () => {
    const user = userEvent.setup();
    form();
    const field = screen.getByLabelText(/near the limit.*margin/i);
    await user.clear(field);
    await user.type(field, "5");
    expect(
      screen.getByText(/scores near the limit from/i),
    ).toHaveTextContent("25 kt");
  });

  it("refuses a margin that would make calm air near the limit", async () => {
    // A 30 kt margin on a 30 kt limit puts the boundary at zero.
    const user = userEvent.setup();
    form();
    const field = screen.getByLabelText(/near the limit.*margin/i);
    await user.clear(field);
    await user.type(field, "30");
    expect(
      screen.getByRole("button", { name: /FRAT policy/i }),
    ).toBeDisabled();
    expect(screen.getByText(/calm included/)).toBeInTheDocument();
  });

  it("sends changed limits", async () => {
    const user = userEvent.setup();
    const action = vi.fn(
      async (): Promise<SaveThresholdsState> => ({ status: "saved" }),
    );
    render(<ThresholdForm config={config()} saveAction={action} />);

    const single = screen.getByLabelText(/Single-engine crosswind/i);
    await user.clear(single);
    await user.type(single, "25");
    await user.click(screen.getByRole("button", { name: /FRAT policy/i }));

    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ crosswindSingleKt: 25 }),
    );
  });

  it("says plainly that IFR approach minima are not scored", () => {
    // The other half of the operator's answer, which we cannot
    // implement: approach minima are per airport and per procedure and
    // we hold none. Saying so on the screen beats a number that looks
    // like an answer.
    form();
    expect(
      screen.getByText(/approach minima are per airport/i),
    ).toBeInTheDocument();
  });

  it("treats an unchanged policy as still on the defaults", () => {
    // The adoption prompt only makes sense while every number is still
    // shipped — including the five limits, which is why isDefault
    // covers all eight.
    form({ adopted_at: null });
    expect(
      screen.getByText(/Saving unchanged still records/),
    ).toBeInTheDocument();
  });

  it("drops the adoption prompt once a limit is changed", async () => {
    const user = userEvent.setup();
    form({ adopted_at: null });
    const field = screen.getByLabelText(/Multi-engine crosswind/i);
    await user.clear(field);
    await user.type(field, "40");
    expect(
      screen.queryByText(/Saving unchanged still records/),
    ).not.toBeInTheDocument();
  });
});


/**
 * Block validity — how long a filed FRAT can be carried to a later
 * leg. ops-service has scored against this since services#233; until
 * now the only way to change it was SQL, which is not a setting.
 */
describe("block validity", () => {
  it("shows the operator's four hours", () => {
    form();
    expect(screen.getByLabelText(/Block validity/i)).toHaveValue(4);
  });

  it("says what the number means in the pilot's terms", () => {
    form();
    expect(
      screen.getByText(/can be carried to a later leg for/i),
    ).toHaveTextContent(/4 hours/);
  });

  it("says blocks are off at zero rather than showing '0 hours'", async () => {
    // Zero is a policy an operator can legitimately choose, not an
    // empty field, so it gets a sentence of its own.
    const user = userEvent.setup();
    form();
    const input = screen.getByLabelText(/Block validity/i);
    await user.clear(input);
    await user.type(input, "0");
    expect(screen.getByText(/Blocks are off/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 hours/)).not.toBeInTheDocument();
  });

  it("says hour, not hours, at one", async () => {
    const user = userEvent.setup();
    form();
    const input = screen.getByLabelText(/Block validity/i);
    await user.clear(input);
    await user.type(input, "1");
    expect(
      screen.getByText(/can be carried to a later leg for/i),
    ).toHaveTextContent(/1 hour(?!s)/);
  });

  it("saves it with the rest of the policy", async () => {
    // One save, one adoption record: an operator who reviewed their
    // FRAT policy reviewed all of it.
    const user = userEvent.setup();
    const action = form();
    const input = screen.getByLabelText(/Block validity/i);
    await user.clear(input);
    await user.type(input, "2");
    await user.click(screen.getByRole("button", { name: /FRAT policy/i }));
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ blockValidityHours: 2 }),
    );
  });

  it("will not save more than a day", async () => {
    // A FRAT carried across more than a day is not an assessment of
    // the flight any more. The server has the same bound; this is so
    // the operator does not have to round-trip to find out.
    const user = userEvent.setup();
    form();
    const input = screen.getByLabelText(/Block validity/i);
    await user.clear(input);
    await user.type(input, "25");
    expect(
      screen.getByRole("button", { name: /FRAT policy/i }),
    ).toBeDisabled();
  });

  it("counts as departing from the shipped defaults", async () => {
    // The "saving unchanged still records it" notice only shows while
    // every number is still ours. A changed block length that did not
    // count would leave the screen offering to record an unchanged
    // review of a policy the operator had in fact changed.
    const user = userEvent.setup();
    form();
    expect(
      screen.getByText(/Saving unchanged still records/i),
    ).toBeInTheDocument();

    const input = screen.getByLabelText(/Block validity/i);
    await user.clear(input);
    await user.type(input, "8");
    expect(
      screen.queryByText(/Saving unchanged still records/i),
    ).not.toBeInTheDocument();
  });
});

