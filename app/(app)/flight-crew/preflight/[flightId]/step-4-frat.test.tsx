import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  completeStepAction: vi.fn(),
  recordFratAuthorizationAction: vi.fn(),
  submitFratAction: vi.fn(),
}));

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
