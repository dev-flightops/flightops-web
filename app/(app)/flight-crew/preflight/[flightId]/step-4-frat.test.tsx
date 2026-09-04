import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  completeStepAction: vi.fn(),
  recordFratAuthorizationAction: vi.fn(),
  submitFratAction: vi.fn(),
}));

import { FlightRiskAssessmentStep } from "./step-4-frat";

/**
 * The FRAT's wind factor is scored against "the aircraft's crosswind
 * limit" — its anchors read "near aircraft crosswind limit" and "above
 * crosswind limit". Until this change the system held no such number, so
 * the pilot was asked to compare against a figure they had to remember.
 *
 * These tests cover the two states that matter: the number is known, or
 * it is not. The second is the one worth being careful about — there is
 * no regulatory crosswind limit to fall back on, so an unrecorded value
 * has to read as unrecorded rather than as a number nobody entered.
 */

const renderStep = (crosswindLimitKt?: number | null) =>
  render(
    <FlightRiskAssessmentStep
      flightId="f-1"
      initial={null}
      crosswindLimitKt={crosswindLimitKt}
    />,
  );

describe("the wind factor's crosswind reference", () => {
  it("shows the aircraft's figure when it is recorded", () => {
    renderStep(20);
    expect(screen.getByText("20 kt")).toBeInTheDocument();
    expect(
      screen.getByText(/max demonstrated crosswind/i),
    ).toBeInTheDocument();
  });

  it("says it is not recorded rather than implying a number", () => {
    // The important half. A blank or a zero here would be read as a
    // limit; the words send the pilot to the AFM instead.
    renderStep(null);
    expect(
      screen.getByText(/not recorded for this aircraft/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ kt$/)).not.toBeInTheDocument();
  });

  it("treats an absent prop the same as an explicit null", () => {
    // Older payloads predate the field, so undefined has to behave.
    renderStep(undefined);
    expect(
      screen.getByText(/not recorded for this aircraft/i),
    ).toBeInTheDocument();
  });

  it("marks the unrecorded case as something to act on", () => {
    // Amber rather than muted grey: the pilot still has to find the
    // number, so this is a prompt, not a footnote.
    renderStep(null);
    expect(
      screen.getByText(/not recorded for this aircraft/i).className,
    ).toMatch(/status-yellow/);
  });

  it("attaches the reference to the wind factor only", () => {
    // Every factor renders through the same row component; the note
    // belongs to the one whose anchors are written against a number.
    renderStep(20);
    expect(screen.getAllByText(/max demonstrated crosswind/i)).toHaveLength(1);
  });

  it("still renders the rest of the questionnaire either way", () => {
    // A missing crosswind must not cost the pilot the FRAT.
    renderStep(null);
    expect(screen.getByText("Wind & gusts")).toBeInTheDocument();
    expect(screen.getByText("Ceiling")).toBeInTheDocument();
    expect(screen.getByText("Visibility")).toBeInTheDocument();
  });
});
