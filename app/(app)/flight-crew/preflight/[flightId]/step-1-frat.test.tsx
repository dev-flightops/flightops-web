import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  completeStepAction: vi.fn(),
  recordFratAuthorizationAction: vi.fn(),
  submitFratAction: vi.fn(async () => ({ ok: true })),
}));

import { submitFratAction } from "./actions";

import type {
  FratAssessmentResponse,
  FratBlockEligibilityResponse,
  FratPrefillResponse,
} from "@/lib/api/types";

import { FACTOR_GROUPS } from "@/lib/frat/factors";

import { FlightRiskAssessmentStep } from "./step-1-frat";

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
  /** A filed assessment, for the tests that exercise the panel shown
   *  after submission rather than the questionnaire. */
  initial?: FratAssessmentResponse | null;
  /** The questionnaire with no FRAT on file is the FRAT page's: in the
   *  preflight the pilot waits for dispatch to file it (#175). A filed
   *  one is shown as the preflight shows it, with Continue. */
  mode?: "preflight" | "page";
}) =>
  render(
    <FlightRiskAssessmentStep
      flightId="f-1"
      initial={null}
      {...props}
      mode={props.mode ?? (props.initial ? "preflight" : "page")}
    />,
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
    // It has a real column now (services 0101). It used to be appended
    // to the mitigations text, which mixed a system record into the
    // pilot's own words and could not be queried.
    const user = userEvent.setup();
    renderStep({});
    await user.click(
      screen.getByRole("button", { name: /submit assessment/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /genuinely zero/i }),
    );
    const call = vi.mocked(submitFratAction).mock.calls.at(-1);
    expect(call?.[1].affirmed_zero_factors).toHaveLength(18);
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

  it("shows the duty day at landing, and its band", () => {
    // The client, 27 Sep: almost 8h in and the slider still read "First
    // flight, well under 8h". The prefill now measures to the landing.
    renderStep({
      fratPrefill: {
        flight_id: "f-1",
        suggestions: [
          {
            factor: "pilot_duty",
            score: 4,
            source:
              "duty clock: on duty since 06:05Z; this flight lands about 17:58Z, 11h 53m into the duty day (limit 14h)",
          },
        ],
        crosswind_limit_kt: 30,
        near_limit_entry_kt: 20,
        vfr_min_ceiling_ft: 1000,
        vfr_min_visibility_sm: 3,
      },
    });
    expect(
      screen.getByText(/11h 53m into the duty day \(limit 14h\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("Lands 10h+ in — heading toward the limit")).toBeInTheDocument();
  });

  it("does not double the full stop after a source that ends in one", () => {
    // The client's 27 Sep screenshot: "Adjust if that is not your rest..
    // Change it if you disagree."
    renderStep({
      fratPrefill: {
        flight_id: "f-1",
        suggestions: [
          {
            factor: "pilot_rest",
            score: 0,
            source: "duty clock: no rest warning. Adjust if that is not your rest.",
          },
        ],
        crosswind_limit_kt: 30,
        near_limit_entry_kt: 20,
        vfr_min_ceiling_ft: 1000,
        vfr_min_visibility_sm: 3,
      },
    });
    const line = screen.getByText(/Adjust if that is not your rest/).closest("p");
    expect(line).toHaveTextContent("not your rest. Change it if you disagree.");
    expect(line?.textContent).not.toContain("..");
  });

  it("keeps 5 on the duty scale for landing past the limit", () => {
    // 5 is the operator's "out of company limits": a no-go. A legal
    // 12-14h day must not read as one, which "Past 12h" did.
    renderStep({
      fratPrefill: {
        flight_id: "f-1",
        suggestions: [{ factor: "pilot_duty", score: 5, source: "duty clock: past the limit" }],
        crosswind_limit_kt: 30,
        near_limit_entry_kt: 20,
        vfr_min_ceiling_ft: 1000,
        vfr_min_visibility_sm: 3,
      },
    });
    expect(screen.getByText("Lands past the duty limit — out of limits")).toBeInTheDocument();
    expect(screen.queryByText(/Past 12h/)).toBeNull();
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


/**
 * The affirmation used to be appended to the pilot's mitigations text
 * as a sentence. It has its own column now, and these pin the three
 * things that made the old way wrong.
 */
describe("affirming untouched zeros", () => {
  beforeEach(() => {
    vi.mocked(submitFratAction).mockClear();
  });

  it("sends the affirmed codes in their own field", async () => {
    const user = userEvent.setup();
    renderStep({});
    await user.click(screen.getByRole("button", { name: /Submit assessment/i }));
    await user.click(screen.getByRole("button", { name: /genuinely zero/i }));

    const [, body] = vi.mocked(submitFratAction).mock.calls.at(-1)!;
    expect(body.affirmed_zero_factors).toBeDefined();
    expect(body.affirmed_zero_factors!.length).toBeGreaterThan(0);
    // Codes, because that is what the backend validates against the
    // answers it was sent.
    expect(body.affirmed_zero_factors).toContain("pilot_health");
  });

  it("leaves the pilot's mitigations text alone", async () => {
    // It is their field. The old sentence mixed a system record into
    // the words a pilot wrote, and they could edit or delete it.
    const user = userEvent.setup();
    renderStep({});
    await user.type(
      screen.getByPlaceholderText(/What risk controls/i),
      "Briefed the crew.",
    );
    await user.click(screen.getByRole("button", { name: /Submit assessment/i }));
    await user.click(screen.getByRole("button", { name: /genuinely zero/i }));

    const [, body] = vi.mocked(submitFratAction).mock.calls.at(-1)!;
    expect(body.mitigations).toBe("Briefed the crew.");
    expect(body.mitigations).not.toMatch(/genuinely zero/i);
  });

  it("does not send it on a block carry-forward", async () => {
    // Those answers came from a questionnaire the pilot answered on an
    // earlier leg, so there is nothing to affirm here and claiming
    // otherwise would put a statement in the record they never made.
    const user = userEvent.setup();
    renderStep({ fratBlock: eligibleBlock });
    await user.click(
      screen.getByRole("button", { name: /accept new weight & balance/i }),
    );
    const [, body] = vi.mocked(submitFratAction).mock.calls.at(-1)!;
    expect(body.affirmed_zero_factors).toBeUndefined();
  });
});


/**
 * The operator, 25 September, asked what "elevated risk" should be:
 *
 *   I really don't have a point value or threshold. You're probably
 *   right to put each one at 4/5 for elevated risk. 5 being out of
 *   company limits.
 *
 *   Over company limits is a no go. Higher risk is something to
 *   caution dispatchers and pilots before heading out the door.
 *
 * So 4 cautions and 5 stops, per factor, and the stop has to survive a
 * low total. Filed exactly this way before the rule existed: wind over
 * the company crosswind limit, everything else genuinely zero, total 5,
 * band LOW, approval "Not required".
 */
const filedOverLimits = (over: string[] = ["wx_wind"]) => ({
  id: "a-1",
  flight_id: "f-1",
  pilot_user_id: "u-1",
  answers: { wx_wind: 5 },
  total_score: 5,
  risk_level: "low" as const,
  mitigations: null,
  over_limit_factors: over,
  affirmed_zero_factors: null,
  carried_from_assessment_id: null,
  created_at: "2026-09-25T12:00:00Z",
  authorizations: [],
});

describe("over company limits", () => {
  it("says no-go even though the total lands in LOW", () => {
    renderStep({ initial: filedOverLimits() });
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Over company limits — this flight is a no-go/i,
    );
  });

  it("names the factor rather than counting it", () => {
    // "1 factor is over limits" makes a pilot go looking.
    renderStep({ initial: filedOverLimits() });
    expect(screen.getByRole("alert")).toHaveTextContent(/Wind & gusts/);
  });

  it("names every one of them", () => {
    renderStep({
      initial: filedOverLimits(["wx_wind", "ac_maintenance"]),
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Wind & gusts/);
    expect(alert).toHaveTextContent(/Maintenance status/);
  });

  it("offers no Continue button at all, not a disabled one", () => {
    // How the over-weight W&B step was fixed on 26 August: a greyed
    // button still reads as "there is a way through, I just have not
    // found it".
    renderStep({ initial: filedOverLimits() });
    expect(
      screen.queryByRole("button", { name: /Continue to Step 2/i }),
    ).not.toBeInTheDocument();
  });

  it("stops the approval line reading 'Not required'", () => {
    renderStep({ initial: filedOverLimits() });
    expect(screen.getByText("No-go")).toBeInTheDocument();
    expect(screen.queryByText("Not required")).not.toBeInTheDocument();
  });

  it("still lets the pilot retake it", () => {
    // The way out of a mis-scored factor, and the only way out.
    renderStep({ initial: filedOverLimits() });
    expect(
      screen.getByRole("button", { name: /Change the FRAT/i }),
    ).toBeInTheDocument();
  });

  it("leaves a within-limits assessment alone", () => {
    renderStep({
      initial: { ...filedOverLimits([]), answers: { wx_wind: 4 } },
    });
    expect(
      screen.getByRole("button", { name: /Continue to Step 2/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no-go/i)).not.toBeInTheDocument();
  });

  it("says the Chief Pilot and DO were alerted, and lets it go once one accepts (#152)", () => {
    // The client, 29 Oct: "a manager override at this step. Sends a ping
    // to chief pilot/DO for an acceptance."
    const { unmount } = renderStep({ initial: filedOverLimits() });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The Chief Pilot and the DO have been alerted. The flight can go once one of them accepts it on the flight's dispatch packet.",
    );
    unmount();

    renderStep({
      initial: {
        ...filedOverLimits(),
        over_limits_accepted: {
          id: "auth-1",
          frat_assessment_id: "a-1",
          kind: "over_limits_accepted" as const,
          authorizer_name: "Dan Ops",
          authorizer_role: "Director of Operations",
          authorizer_cert_number: null,
          notes: "Runway 12 keeps it in limits",
          authorized_at: "2026-09-25T12:20:00Z",
        },
      },
    });
    expect(screen.queryByText(/this flight is a no-go/i)).not.toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Wind & gusts: accepted by Dan Ops (Director of Operations), Sep 25, 12:20Z.",
    );
    expect(screen.getByRole("note")).toHaveTextContent("“Runway 12 keeps it in limits”");
    expect(screen.getByRole("button", { name: /Continue to Step 2/i })).toBeInTheDocument();
  });
});

// ---- #88: never below the dispatch packet --------------------------------------

describe("the dispatch packet's level", () => {
  const PREFILL: FratPrefillResponse = {
    flight_id: "f-1",
    suggestions: [
      { factor: "wx_ceiling", score: 4, source: "lowest ceiling 800 against a 1000 ft floor" },
      { factor: "wx_vis", score: 4, source: "lowest visibility 1.8 against a 3.0 sm floor" },
      { factor: "wx_wind", score: 2, source: "12 kt at PABE against a 30 kt company limit" },
    ],
    crosswind_limit_kt: 30,
    near_limit_entry_kt: 20,
    vfr_min_ceiling_ft: 1000,
    vfr_min_visibility_sm: 3,
    packet_risk_level: "high",
  };

  it("raises the questionnaire's level to the packet's, and says why (PGR701)", () => {
    renderStep({ ...singleEngine, fratPrefill: PREFILL });
    // 4 + 4 + 2 is 10: LOW on the bands, HIGH on the packet.
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.queryByText("LOW")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "HIGH, not the score's LOW: the dispatch packet rates this flight HIGH, and a FRAT is never filed below the packet.",
      ),
    ).toBeInTheDocument();
    // The form is open only before the release (#155).
    expect(screen.queryByText(/at release/)).not.toBeInTheDocument();
  });

  it("says at the top of the form that the packet holds the level up (#177)", () => {
    // MM1181: the sliders went down and the level stayed HIGH.
    renderStep({ ...singleEngine, fratPrefill: PREFILL });
    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent("Dispatch packet: HIGH");
    expect(notice).toHaveTextContent(
      "The packet rates this flight HIGH, so the FRAT is filed at HIGH or higher, whatever the scores below add up to.",
    );
  });

  it("has no notice when the packet is LOW, which holds nothing up", () => {
    renderStep({ ...singleEngine, fratPrefill: { ...PREFILL, packet_risk_level: "low" } });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByText("The dispatch packet rates this flight LOW.")).toBeInTheDocument();
  });

  it("says nothing when the packet hasn't been scored", () => {
    renderStep({ ...singleEngine, fratPrefill: { ...PREFILL, packet_risk_level: null } });
    expect(screen.getByText("LOW")).toBeInTheDocument();
    expect(screen.queryByText(/dispatch packet/i)).not.toBeInTheDocument();
  });

  // Filed while the packet was HIGH: 10 points, LOW on the bands.
  const filedHigh = (over: Partial<FratAssessmentResponse> = {}): FratAssessmentResponse => ({
    ...filedOverLimits([]),
    answers: { wx_ceiling: 4, wx_vis: 4, wx_wind: 2 },
    total_score: 10,
    risk_level: "high",
    score_risk_level: "low",
    packet_risk_level: "high",
    ...over,
  });

  it("says the packet raised a filed FRAT, and still rates it so", () => {
    renderStep({ initial: filedHigh() });
    expect(screen.getByText(/^Filed at HIGH/)).toHaveTextContent(
      "Filed at HIGH, not the score's LOW: the dispatch packet rated the flight HIGH when this FRAT was filed, and a FRAT is never filed below the packet. The packet still rates it HIGH.",
    );
  });

  it("names the packet's level when the FRAT was filed, not today's (MM1181)", () => {
    // The packet has rated MM1181 MEDIUM since its FRATs were filed. The note
    // read "Raised to HIGH by the dispatch packet, which rated this flight
    // MEDIUM at release", before any release.
    renderStep({ initial: filedHigh({ packet_risk_level: "medium" }) });
    const note = screen.getByText(/^Filed at HIGH/);
    expect(note).toHaveTextContent("the dispatch packet rated the flight HIGH when this FRAT was filed");
    expect(note).toHaveTextContent(
      "The packet now rates it MEDIUM: filed again with the same scores, it would be MEDIUM.",
    );
    expect(note).not.toHaveTextContent(/at release/);
  });

  it("doesn't say what a released FRAT would be filed at", () => {
    renderStep({ initial: filedHigh({ packet_risk_level: "medium", locked: true }) });
    const note = screen.getByText(/^Filed at HIGH/);
    expect(note).toHaveTextContent("The packet has since changed to MEDIUM.");
    expect(note).not.toHaveTextContent(/filed again/);
  });

  it("says when the packet has risen above a filed FRAT", () => {
    renderStep({ initial: filedHigh({ risk_level: "low" }) });
    expect(screen.getByText(/^The dispatch packet has since risen/)).toHaveTextContent(
      "The dispatch packet has since risen to HIGH, above this FRAT's LOW: filed again with the same scores, it would be HIGH.",
    );
  });
});

// ---- #117: where the weather came from -----------------------------------------------

describe("the weather each stop was scored on", () => {
  const STOP = {
    certified: true,
    described: "METAR",
    ceiling_ft: null,
    ceiling_from: "METAR",
    visibility_sm: 10,
    visibility_from: "METAR",
    wind_direction: "360",
    wind_kt: 5,
    wind_gust_kt: null,
    wind_from: "METAR",
  };
  const PREFILL: FratPrefillResponse = {
    flight_id: "f-1",
    suggestions: [
      {
        factor: "wx_ceiling",
        score: 4,
        source: "lowest ceiling 600 ft at PAEE (FAA WeatherCam, not certified) against a 1000 ft floor",
      },
      {
        factor: "wx_icing",
        score: 4,
        source:
          "light icing PIREP near PABE (official PIREPs within 50 nm of each stop, last 3 hours)",
      },
    ],
    crosswind_limit_kt: 30,
    near_limit_entry_kt: 20,
    vfr_min_ceiling_ft: 1000,
    vfr_min_visibility_sm: 3,
    stops: [
      { ...STOP, ident: "PABE", source: "metar" },
      {
        ...STOP,
        ident: "PAEE",
        source: "weathercam",
        certified: false,
        described: "FAA WeatherCam, not certified",
        ceiling_ft: 600,
        ceiling_from: "FAA WeatherCam",
      },
    ],
    non_certified_weather: true,
  };

  it("lists each stop's source and gives the OpSpecs notice", () => {
    renderStep({ ...singleEngine, fratPrefill: PREFILL });
    expect(screen.getByText("Weather used")).toBeInTheDocument();
    expect(screen.getByText("Official METAR/TAF")).toBeInTheDocument();
    expect(screen.getByText("FAA WeatherCam · Not certified")).toBeInTheDocument();
    expect(screen.getByText("Not certified weather")).toBeInTheDocument();
    // The PIREPs' icing suggestion is prefilled like the others.
    expect(screen.getByText(/light icing PIREP near PABE/)).toBeInTheDocument();
  });

  it("gives no notice when every stop is on its METAR", () => {
    renderStep({
      ...singleEngine,
      fratPrefill: {
        ...PREFILL,
        stops: [{ ...STOP, ident: "PABE", source: "metar" }],
        non_certified_weather: false,
      },
    });
    expect(screen.getByText("Official METAR/TAF")).toBeInTheDocument();
    expect(screen.queryByText("Not certified weather")).not.toBeInTheDocument();
  });
});

/**
 * The approach minimums on an IFR flight (#124). The client: "Ifr flights
 * below approach mins are elevated risk as well." The system holds no
 * approach minima, so the pilot answers from the plates; below them the
 * flight may not take off under IFR (14 CFR 135.219), a no-go.
 */
const ifrPrefill: FratPrefillResponse = {
  flight_id: "f-1",
  suggestions: ["wx_ceiling", "wx_vis"].map((factor) => ({
    factor,
    score: null,
    source: "company weather limits",
    unavailable_reason:
      "This is an IFR flight, scored from your answer on the approach minimums at arrival.",
  })),
  crosswind_limit_kt: 30,
  near_limit_entry_kt: 20,
  vfr_min_ceiling_ft: 1000,
  vfr_min_visibility_sm: 3,
  asks_approach_minimums: true,
};

const question = (which: "ceiling" | "visibility") =>
  screen.getByRole("group", {
    name: `IFR: is the forecast ${which} at arrival at or above the approach minimums?`,
  });

describe("the approach minimums on an IFR flight", () => {
  beforeEach(() => vi.mocked(submitFratAction).mockClear());

  it("asks about the ceiling and the visibility, and nothing else", () => {
    renderStep({ fratPrefill: ifrPrefill });
    expect(question("ceiling")).toBeInTheDocument();
    expect(question("visibility")).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /approach minimums/ })).toHaveLength(2);
  });

  it("is not asked on a VFR flight", () => {
    renderStep({ fratPrefill: { ...ifrPrefill, asks_approach_minimums: false } });
    expect(screen.queryByRole("group", { name: /approach minimums/ })).not.toBeInTheDocument();
  });

  it("scores a no over company limits and holds it there", async () => {
    const user = userEvent.setup();
    renderStep({ fratPrefill: ifrPrefill });
    await user.click(within(question("ceiling")).getByRole("button", { name: "No" }));
    const ceiling = screen.getByLabelText("Ceiling");
    expect(ceiling).toHaveValue("5");
    expect(ceiling).toBeDisabled();
    expect(screen.getByText(/may not take off IFR \(14 CFR 135\.219\)/)).toBeInTheDocument();

    // Yes again lets it go back to what the weather scored.
    await user.click(within(question("ceiling")).getByRole("button", { name: "Yes" }));
    expect(ceiling).toHaveValue("0");
    expect(ceiling).toBeEnabled();
  });

  it("won't file until both are answered, then sends them", async () => {
    const user = userEvent.setup();
    renderStep({ fratPrefill: ifrPrefill });
    await user.click(screen.getByRole("button", { name: /submit assessment/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Answer whether the forecast ceiling and visibility at arrival are at or above the approach minimums.",
    );
    expect(submitFratAction).not.toHaveBeenCalled();

    await user.click(within(question("ceiling")).getByRole("button", { name: "Yes" }));
    await user.click(within(question("visibility")).getByRole("button", { name: "No" }));
    await user.click(screen.getByRole("button", { name: /submit assessment/i }));
    await user.click(screen.getByRole("button", { name: /genuinely zero/i }));
    const body = vi.mocked(submitFratAction).mock.calls.at(-1)?.[1];
    expect(body?.approach_minimums).toEqual({ ceiling: true, visibility: false });
    expect(body?.answers.wx_ceiling).toBe(0);
    expect(body?.answers.wx_vis).toBe(5);
    // Answered, so neither is among the unassessed zeros.
    expect(body?.affirmed_zero_factors).not.toContain("wx_ceiling");
  });

  it("shows the answers on the filed assessment", () => {
    renderStep({
      initial: {
        id: "a-1",
        flight_id: "f-1",
        pilot_user_id: "u-1",
        answers: { wx_ceiling: 0, wx_vis: 5 },
        total_score: 5,
        risk_level: "low",
        mitigations: null,
        over_limit_factors: ["wx_vis"],
        affirmed_zero_factors: null,
        carried_from_assessment_id: null,
        approach_minimums: { ceiling: true, visibility: false },
        created_at: "2026-10-26T12:00:00Z",
        authorizations: [],
      },
    });
    expect(
      screen.getByText(
        "Ceiling at or above · visibility below, the pilot's answer from the approach plates.",
      ),
    ).toBeInTheDocument();
  });
});

// ---- #175: dispatch scores it, the pilot sees each score and signs -------------

describe("the FRAT dispatch scored, in the pilot's preflight (#175)", () => {
  // Filed from the form, a FRAT answers every factor.
  const everyFactor = (scores: Record<string, number>) => ({
    ...Object.fromEntries(FACTOR_GROUPS.flatMap((g) => g.factors).map((f) => [f.code, 0])),
    ...scores,
  });
  const filed = (over: Partial<FratAssessmentResponse> = {}): FratAssessmentResponse => ({
    id: "a-175",
    flight_id: "f-1",
    pilot_user_id: "u-1",
    answers: everyFactor({ wx_ceiling: 2, wx_wind: 4 }),
    total_score: 6,
    risk_level: "low",
    mitigations: "Wait for the ceiling to lift at PACK.",
    over_limit_factors: [],
    affirmed_zero_factors: null,
    carried_from_assessment_id: null,
    created_at: "2026-11-09T01:51:00Z",
    authorizations: [],
    signoffs: [],
    ...over,
  });

  it("waits for dispatch before there is one", () => {
    renderStep({ mode: "preflight" });
    expect(screen.getByRole("note")).toHaveTextContent(
      "Dispatch scores the FRAT and signs it once the flight is built.",
    );
    expect(screen.queryByRole("button", { name: /Submit assessment/i })).not.toBeInTheDocument();
  });

  it("shows every factor's score, and what the data suggests where it differs", () => {
    renderStep({
      initial: filed(),
      fratPrefill: {
        flight_id: "f-1",
        suggestions: [
          { factor: "wx_ceiling", score: 4, source: "lowest ceiling 800 against a 1000 ft floor" },
          { factor: "wx_wind", score: 4, source: "12 kt at PABE against a 30 kt company limit" },
        ],
        crosswind_limit_kt: 30,
        near_limit_entry_kt: 20,
        vfr_min_ceiling_ft: 1000,
        vfr_min_visibility_sm: 3,
      },
    });
    const scores = screen.getByLabelText("Each factor's score");
    const ceiling = within(scores).getByText("Ceiling").closest("li")!;
    expect(ceiling).toHaveTextContent("The data suggests 4: lowest ceiling 800 against a 1000 ft floor");
    expect(within(ceiling).getByText("2")).toBeInTheDocument();
    const wind = within(scores).getByText("Wind & gusts").closest("li")!;
    expect(wind).toHaveTextContent("12 kt at PABE against a 30 kt company limit");
    expect(wind).not.toHaveTextContent("suggests");
  });

  it("holds Continue until dispatch has signed, then the pilot", () => {
    const { unmount } = renderStep({ initial: filed() });
    expect(screen.getByRole("button", { name: "Waiting for dispatch to sign" })).toBeDisabled();
    unmount();
    renderStep({
      initial: filed({
        signoffs: [
          {
            role: "dispatcher",
            user_id: "d-1",
            signer_name: "Dana Dispatch",
            signed_at: "2026-11-09T01:52:00Z",
            flight_minutes_today: null,
            flight_minutes_remaining: null,
          },
        ],
      }),
    });
    expect(screen.getByRole("button", { name: "Sign the FRAT to continue" })).toBeDisabled();
  });

  it("starts a change from the scores on file, and shows the new FRAT once it's filed", async () => {
    const user = userEvent.setup();
    const { rerender } = renderStep({ initial: filed() });
    await user.click(screen.getByRole("button", { name: /Change the FRAT/i }));
    expect(screen.getByLabelText(/Wind & gusts/i, { selector: "input" })).toHaveValue("4");
    expect(screen.getByLabelText(/Ceiling/i, { selector: "input" })).toHaveValue("2");
    expect(screen.getByDisplayValue("Wait for the ceiling to lift at PACK.")).toBeInTheDocument();
    // Every factor on file counts as assessed: no confirmation of zeros.
    expect(screen.queryByText(/still at zero and have not been assessed/i)).not.toBeInTheDocument();

    // On the demo the form stayed open after filing and the pilot filed
    // the same change again a minute later. The new FRAT closes it.
    rerender(
      <FlightRiskAssessmentStep
        flightId="f-1"
        initial={filed({ id: "a-176", answers: everyFactor({ wx_ceiling: 3, wx_wind: 4 }), total_score: 7 })}
        mode="preflight"
      />,
    );
    expect(screen.queryByRole("button", { name: /File the change/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Each factor's score")).toBeInTheDocument();
  });

  it("offers no change once the flight is released", () => {
    renderStep({ initial: filed({ locked: true }) });
    expect(screen.queryByRole("button", { name: /Change the FRAT/i })).not.toBeInTheDocument();
    expect(screen.getByText(/its FRAT stays as signed/)).toBeInTheDocument();
  });

  it("can keep the FRAT as it is", async () => {
    const user = userEvent.setup();
    renderStep({ initial: filed() });
    await user.click(screen.getByRole("button", { name: /Change the FRAT/i }));
    await user.click(screen.getByRole("button", { name: "Keep the FRAT as it is" }));
    expect(screen.getByLabelText("Each factor's score")).toBeInTheDocument();
  });
});

/**
 * Mountain terrain (LOG-03). The client, 11/13: "it should read mountain
 * terrain yes or no and add a small risk for terrain maybe a point in day
 * two at night if marked yes". The prefill says whether the flight is at
 * night, by the dispatch matrix's own reading.
 */
describe("mountain terrain, yes or no (LOG-03)", () => {
  beforeEach(() => vi.mocked(submitFratAction).mockClear());

  const prefill = (night: boolean | null, night_reason: string | null = null): FratPrefillResponse => ({
    flight_id: "f-1",
    suggestions: [],
    vfr_min_ceiling_ft: 1000,
    vfr_min_visibility_sm: 3,
    night,
    night_reason,
  });
  const mountain = () => screen.getByRole("group", { name: "Mountain terrain" });
  const fileIt = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /Submit assessment/i }));
    await user.click(screen.getByRole("button", { name: /genuinely zero/i }));
    return vi.mocked(submitFratAction).mock.calls.at(-1)![1];
  };

  it("asks yes or no, and a yes counts 2 on a flight at night", async () => {
    const user = userEvent.setup();
    renderStep({ fratPrefill: prefill(true, "night at departure PANC 1000Z") });
    expect(within(mountain()).getByRole("button", { name: "No" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Yes counts 2: night at departure PANC 1000Z.")).toBeInTheDocument();
    await user.click(within(mountain()).getByRole("button", { name: "Yes" }));
    expect(within(mountain()).getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Yes, at night")).toBeInTheDocument();
    expect((await fileIt(user)).answers.route_mountain).toBe(2);
  });

  it("counts a yes 1 by day", async () => {
    const user = userEvent.setup();
    renderStep({ fratPrefill: prefill(false) });
    expect(screen.getByText("Yes counts 1: the flight is by day.")).toBeInTheDocument();
    await user.click(within(mountain()).getByRole("button", { name: "Yes" }));
    expect(screen.getByText("Yes, by day")).toBeInTheDocument();
    expect((await fileIt(user)).answers.route_mountain).toBe(1);
  });

  it("counts a yes 2 when day can't be told from night, and says why", async () => {
    const user = userEvent.setup();
    renderStep({ fratPrefill: prefill(null, "position unknown for 9Z8; enter it under Stations") });
    expect(
      screen.getByText("Yes counts 2, as at night: position unknown for 9Z8; enter it under Stations."),
    ).toBeInTheDocument();
    await user.click(within(mountain()).getByRole("button", { name: "Yes" }));
    expect((await fileIt(user)).answers.route_mountain).toBe(2);
  });

  it("sends no terrain score from before, and a no as a 0", async () => {
    const user = userEvent.setup();
    renderStep({ fratPrefill: prefill(false) });
    const answers = (await fileIt(user)).answers;
    expect(answers.route_mountain).toBe(0);
    expect(answers).not.toHaveProperty("route_terrain");
  });

  const everyFactor = (scores: Record<string, number>) => ({
    ...Object.fromEntries(FACTOR_GROUPS.flatMap((g) => g.factors).map((f) => [f.code, 0])),
    ...scores,
  });
  const filed = (answers: Record<string, number>): FratAssessmentResponse => ({
    id: "a-03",
    flight_id: "f-1",
    pilot_user_id: "u-1",
    answers,
    total_score: Object.values(answers).reduce((a, b) => a + b, 0),
    risk_level: "low",
    mitigations: null,
    over_limit_factors: [],
    affirmed_zero_factors: null,
    carried_from_assessment_id: null,
    created_at: "2026-11-13T15:00:00Z",
    authorizations: [],
    signoffs: [],
  });

  it("reads a filed yes back as yes, at night", () => {
    renderStep({ initial: filed(everyFactor({ route_mountain: 2 })) });
    const scores = screen.getByLabelText("Each factor's score");
    expect(within(scores).getByText("Mountain terrain")).toBeInTheDocument();
    expect(within(scores).getByText("Yes, at night")).toBeInTheDocument();
  });

  it("shows a FRAT filed before it with its terrain score, not a mountain answer it wasn't asked", () => {
    const { route_mountain: _, ...before } = everyFactor({ route_terrain: 4 });
    renderStep({ initial: filed(before) });
    const scores = screen.getByLabelText("Each factor's score");
    expect(within(scores).getByText("Terrain challenge")).toBeInTheDocument();
    expect(within(scores).queryByText("Mountain terrain")).not.toBeInTheDocument();
  });

  it("scores a yes on file for this flight's night when the FRAT is changed", async () => {
    const user = userEvent.setup();
    renderStep({ initial: filed(everyFactor({ route_mountain: 1 })), fratPrefill: prefill(true, "night at arrival PABE 1130Z") });
    await user.click(screen.getByRole("button", { name: /Change the FRAT/i }));
    expect(within(mountain()).getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Yes, at night")).toBeInTheDocument();
  });
});
