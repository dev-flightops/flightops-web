import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  completeStepAction: vi.fn(),
  recordFratAuthorizationAction: vi.fn(),
  submitFratAction: vi.fn(async () => ({ ok: true })),
}));

import { submitFratAction } from "./actions";

import type {
  FratBlockEligibilityResponse,
  FratPrefillResponse,
} from "@/lib/api/types";

import { FlightRiskAssessmentStep } from "./step-4-frat";

/**
 * What the wind factor is scored against — and it used to be the wrong
 * number.
 *
 * The anchors read "near aircraft crosswind limit" and "above crosswind
 * limit", and the step showed the pilot
 * `aircraft.max_demonstrated_crosswind_kt` labelled "max demonstrated
 * crosswind". The operator, 22 September 2026:
 *
 *   crosswinds is tricky because demonstrated does not limit us. Our
 *   single engine x wind limits are 30kts multi engines are 35kts.
 *   That's a company limit. And many companies operate above the
 *   demonstrated limit. Within 10 knots of a limit is near.
 *
 * So the reference is the operator's own limit, selected by engine
 * count, and the demonstrated figure is context beside it rather than
 * the thing being compared against.
 *
 * Three states matter, and the last two are the careful ones: a limit
 * applies; no engine count is recorded so none can be selected; or the
 * operator's policy could not be read at all. Those are different
 * problems and get different sentences — there is no regulatory
 * crosswind limit to fall back on, so neither may read as a number.
 */

const renderStep = (props: {
  companyCrosswindLimitKt?: number | null;
  nearLimitEntryKt?: number | null;
  demonstratedCrosswindKt?: number | null;
  engineCount?: number | null;
  hasCompanyLimits?: boolean;
  fratPrefill?: FratPrefillResponse | null;
  fratBlock?: FratBlockEligibilityResponse | null;
}) =>
  render(
    <FlightRiskAssessmentStep flightId="f-1" initial={null} {...props} />,
  );

/** A single-engine aircraft on the operator's shipped numbers. */
const singleEngine = {
  companyCrosswindLimitKt: 30,
  nearLimitEntryKt: 20,
  engineCount: 1,
};

describe("the wind factor's crosswind reference", () => {
  it("shows the company limit, not a demonstrated figure", () => {
    renderStep(singleEngine);
    expect(screen.getByText(/Company limit/i)).toBeInTheDocument();
    expect(screen.getByText("30 kt")).toBeInTheDocument();
    // The old label is gone: it named a number the operator says does
    // not bind them.
    expect(
      screen.queryByText(/max demonstrated crosswind/i),
    ).not.toBeInTheDocument();
  });

  it("says where 'near the limit' begins", () => {
    // 30 less a 10 kt margin. Two numbers the pilot would otherwise
    // have to combine in their head mid-preflight.
    renderStep(singleEngine);
    expect(screen.getByText(/near from/i)).toBeInTheDocument();
    expect(screen.getByText("20 kt")).toBeInTheDocument();
  });

  it("names which limit applies", () => {
    renderStep(singleEngine);
    expect(screen.getByText(/single-engine/i)).toBeInTheDocument();
  });

  it("calls a twin multi-engine and uses its higher limit", () => {
    renderStep({
      companyCrosswindLimitKt: 35,
      nearLimitEntryKt: 25,
      engineCount: 2,
    });
    expect(screen.getByText(/multi-engine/i)).toBeInTheDocument();
    expect(screen.getByText("35 kt")).toBeInTheDocument();
  });

  it("shows the demonstrated figure as context when recorded", () => {
    // Still worth seeing — it is a true fact about the airframe — but
    // clearly subordinate to the company limit.
    renderStep({ ...singleEngine, demonstratedCrosswindKt: 20 });
    expect(screen.getByText(/AFM demonstrated/i)).toBeInTheDocument();
  });

  it("omits the demonstrated figure when it is not recorded", () => {
    renderStep(singleEngine);
    expect(screen.queryByText(/AFM demonstrated/i)).not.toBeInTheDocument();
  });

  it("says the engine count is missing rather than guessing a limit", () => {
    // The important half. Defaulting to single-engine would show a
    // stricter number than policy and defaulting to multi a looser one.
    renderStep({ engineCount: null, companyCrosswindLimitKt: null });
    expect(
      screen.getByText(/Engine count not recorded/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ kt$/)).not.toBeInTheDocument();
  });

  it("points at where an admin can fix that", () => {
    renderStep({ engineCount: null, companyCrosswindLimitKt: null });
    expect(screen.getByText(/Settings → Fleet/i)).toBeInTheDocument();
  });

  it("distinguishes an unreadable policy from a missing engine count", () => {
    // Different problems: one is this aircraft's record, the other is
    // the settings read failing. Telling a pilot to go and set the
    // engine count when the policy itself did not load would send them
    // to the wrong place.
    renderStep({ companyCrosswindLimitKt: null, hasCompanyLimits: false });
    expect(
      screen.getByText(/limits could not be loaded/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Engine count not recorded/i),
    ).not.toBeInTheDocument();
  });

  it("treats absent props the same as explicit nulls", () => {
    // Older payloads predate engine_count, so undefined has to behave.
    renderStep({});
    expect(
      screen.getByText(/Engine count not recorded/i),
    ).toBeInTheDocument();
  });

  it("marks both unresolved cases as something to act on", () => {
    // Amber rather than muted grey: the pilot still has to find the
    // number, so it is a prompt, not a footnote.
    renderStep({ engineCount: null });
    expect(
      screen.getByText(/Engine count not recorded/i).className,
    ).toMatch(/status-yellow/);
  });

  it("attaches the reference to the wind factor only", () => {
    // Every factor renders through the same row component; the note
    // belongs to the one whose anchors are written against a number.
    renderStep(singleEngine);
    expect(screen.getAllByText(/Company limit/i)).toHaveLength(1);
  });

  it("still renders the rest of the questionnaire either way", () => {
    // A missing crosswind limit must not cost the pilot the FRAT.
    renderStep({ engineCount: null });
    expect(screen.getByText("Wind & gusts")).toBeInTheDocument();
    expect(screen.getByText("Ceiling")).toBeInTheDocument();
    expect(screen.getByText("Visibility")).toBeInTheDocument();
  });
});

/**
 * An untouched FRAT files as LOW with approval "not required".
 *
 * Every factor starts at 0, so submitting without touching anything
 * scores 0 and files a clean-looking record of an assessment nobody
 * made. Walking the preflight as a pilot on 23 September confirmed it:
 * "Submit assessment" was enabled with all eighteen sliders at zero.
 *
 * Not blocked — the operator asked for a FRAT that takes seconds, and
 * refusing to submit would fight that. What these cover is that it can
 * no longer happen *silently*.
 */
describe("factors nobody assessed", () => {
  it("says how many are unassessed before submitting", () => {
    renderStep({});
    expect(
      screen.getByText(/have not been assessed/i),
    ).toBeInTheDocument();
  });

  it("asks for confirmation instead of filing silently", async () => {
    const user = userEvent.setup();
    renderStep({});
    await user.click(
      screen.getByRole("button", { name: /submit assessment/i }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent(/not assessed/i);
    // The distinction the copy has to make: zero because nobody
    // answered, not zero because the risk is zero.
    expect(dialog).toHaveTextContent(/not because the risk is zero/i);
  });

  it("offers going back to score them, and going back clears the prompt", async () => {
    const user = userEvent.setup();
    renderStep({});
    await user.click(
      screen.getByRole("button", { name: /submit assessment/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /go back and score them/i }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit assessment/i }),
    ).toBeInTheDocument();
  });

  it("records the confirmation in the filed assessment", async () => {
    // The backend has no field for this yet, so it goes in the
    // mitigations text where an auditor will see it. Losing the fact
    // while waiting for a dedicated column would be worse.
    const user = userEvent.setup();
    renderStep({});
    await user.click(
      screen.getByRole("button", { name: /submit assessment/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /genuinely zero/i }),
    );
    const call = vi.mocked(submitFratAction).mock.calls.at(-1);
    expect(call?.[1].mitigations).toMatch(/confirmed 18 factor/i);
  });

  it("counts a prefilled factor as assessed", async () => {
    // A prefilled value the pilot leaves alone is one they have seen
    // and accepted — which is what showing its provenance is for.
    renderStep({
      fratPrefill: {
        flight_id: "f-1",
        suggestions: [
          { factor: "wx_wind", score: 4, source: "33 kt at PANC" },
          { factor: "wx_ceiling", score: 0, source: "3500 ft" },
        ],
        crosswind_limit_kt: 30,
        near_limit_entry_kt: 20,
        vfr_min_ceiling_ft: 1000,
        vfr_min_visibility_sm: 3,
      },
    });
    // 18 factors, 2 of them prefilled — so 16 remain unassessed.
    expect(screen.getByText("16")).toBeInTheDocument();
  });

  it("does not count a factor the prefill could not score", () => {
    // score: null means the system had no input. That is not an
    // assessment, and treating it as one would restore the silent path.
    renderStep({
      fratPrefill: {
        flight_id: "f-1",
        suggestions: [
          {
            factor: "wx_wind",
            score: null,
            source: "company crosswind limit",
            unavailable_reason: "No wind observation.",
          },
        ],
        crosswind_limit_kt: null,
        near_limit_entry_kt: null,
        vfr_min_ceiling_ft: 1000,
        vfr_min_visibility_sm: 3,
      },
    });
    expect(screen.getByText("18")).toBeInTheDocument();
  });
});

/**
 * Carrying the last FRAT to the next leg.
 *
 * The operator, 25 August: "bases that are launching flights every
 * 15-30 minutes to the same locations... a pilot can press one button
 * like 'accept new weight and balance no other changes to flight risk
 * necessary'". Their rule for what breaks it, 22 September: "4 hours or
 * any condition that increases risk."
 *
 * The backend decides eligibility. What these cover is that the screen
 * offers it when allowed, says why when not, and never hides the
 * reason — an absent button tells a pilot nothing, while "your last
 * FRAT is 5.2h old and the block lasts 4h" tells them what to do.
 */
const eligibleBlock = {
  eligible: true,
  source_assessment_id: "frat-1",
  source_risk_level: "low",
  expires_at: "2026-09-24T18:30:00Z",
  // Deliberately not all zeros, and deliberately including factors
  // this leg's prefill cannot reach. These are the numbers the pilot
  // answered on the previous leg, and they are what "no other changes"
  // has to file.
  source_answers: {
    pilot_rest: 1,
    pilot_health: 3,
    route_terrain: 4,
    wx_wind: 2,
  },
  reasons: [],
  worsened_factors: [],
  block_validity_hours: 4,
};

describe("block FRAT carry-forward", () => {
  // The setup file only calls cleanup(), so a call-count assertion
  // would otherwise count presses from earlier tests in this block.
  beforeEach(() => {
    vi.mocked(submitFratAction).mockClear();
  });

  it("offers the operator's one button when eligible", () => {
    renderStep({ fratBlock: eligibleBlock });
    expect(
      screen.getByRole("button", {
        name: /accept new weight & balance/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows when the block lapses", () => {
    renderStep({ fratBlock: eligibleBlock });
    expect(screen.getByText("18:30Z")).toBeInTheDocument();
  });

  it("says what was checked and what was not", () => {
    // Aircraft swap, crew change and NOTAMs are in the operator's own
    // question and none are checkable — NOTAMs are not wired at all.
    // Claiming the block is safe would overstate what the system knows.
    renderStep({ fratBlock: eligibleBlock });
    expect(screen.getByText(/Not checked:/i)).toHaveTextContent(
      /aircraft swap.*crew change.*NOTAM/i,
    );
  });

  it("shows the reasons rather than hiding the button", async () => {
    renderStep({
      fratBlock: {
        ...eligibleBlock,
        eligible: false,
        source_assessment_id: null,
        source_risk_level: null,
        reasons: [
          "That assessment is 5.2h old and the block lasts 4h.",
          "Conditions have worsened since that assessment: wx_wind.",
        ],
        worsened_factors: ["wx_wind"],
      },
    });
    expect(
      screen.queryByRole("button", { name: /accept new weight/i }),
    ).not.toBeInTheDocument();
    // Both reasons, because a pilot told only the first would fix it
    // and be refused again. Asserted on the container: the heading is
    // its own span, so matching that alone would miss the reasons
    // beside it.
    const notice = screen
      .getByText(/A new assessment is needed/i)
      .closest("div");
    expect(notice).toHaveTextContent(/5\.2h old/);
    expect(notice).toHaveTextContent(/wx_wind/);
  });

  it("offers nothing when the check could not run", () => {
    // Null means the weather was unreachable or the call failed. No
    // claim either way — the questionnaire is still there.
    renderStep({ fratBlock: null });
    expect(
      screen.queryByRole("button", { name: /accept new weight/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/A new assessment is needed/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Wind & gusts")).toBeInTheDocument();
  });

  it("files the carried answers, not the questionnaire's current state", async () => {
    // The defect this replaced: the button submitted the form, which
    // is seeded from *this* leg's prefill and zero everywhere else. So
    // "no other changes" filed different numbers from the assessment
    // it claimed to carry — IMSAFE 3 and terrain 4 becoming zeros
    // nobody assessed, and the filed risk coming out lower than the
    // real one.
    const user = userEvent.setup();
    renderStep({ fratBlock: eligibleBlock });
    await user.click(
      screen.getByRole("button", { name: /accept new weight & balance/i }),
    );
    expect(submitFratAction).toHaveBeenCalledWith(
      "f-1",
      expect.objectContaining({ answers: eligibleBlock.source_answers }),
    );
  });

  it("records what the assessment was carried from", async () => {
    // Provenance. Without it a carried record is indistinguishable
    // from a freshly-scored one holding the same numbers, and for a
    // Part 135 FRAT that difference is the audit trail.
    const user = userEvent.setup();
    renderStep({ fratBlock: eligibleBlock });
    await user.click(
      screen.getByRole("button", { name: /accept new weight & balance/i }),
    );
    expect(submitFratAction).toHaveBeenCalledWith(
      "f-1",
      expect.objectContaining({ carried_from_assessment_id: "frat-1" }),
    );
  });

  it("is one press — no unassessed-factor confirmation", async () => {
    // The operator asked for "one button". The unassessed guard exists
    // to stop a pilot filing eighteen untouched zeros as LOW; a carried
    // assessment is the opposite case, because those numbers came from
    // a questionnaire this pilot answered. Worse, the confirmation
    // renders at the bottom of the form, so from the top of the page
    // the press looked like it did nothing at all.
    const user = userEvent.setup();
    renderStep({ fratBlock: eligibleBlock });
    await user.click(
      screen.getByRole("button", { name: /accept new weight & balance/i }),
    );
    expect(
      screen.queryByRole("button", { name: /genuinely zero/i }),
    ).not.toBeInTheDocument();
    expect(submitFratAction).toHaveBeenCalledTimes(1);
  });

  it("does not offer the button without the answers to file", () => {
    // An eligible verdict with no answers cannot be honoured — the
    // only thing left to submit would be the form state, which is the
    // bug. Fall back to the questionnaire rather than offering a
    // button that files the wrong numbers.
    renderStep({
      fratBlock: { ...eligibleBlock, source_answers: null },
    });
    expect(
      screen.queryByRole("button", { name: /accept new weight/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Wind & gusts")).toBeInTheDocument();
  });
});
