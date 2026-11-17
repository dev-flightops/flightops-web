import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sign = vi.fn(async (..._args: unknown[]) => ({ ok: true }) as { ok: boolean; error?: string });
vi.mock("@/app/(app)/frat/actions", () => ({
  signFratAction: (...args: unknown[]) => sign(...args),
}));

import type { FratAssessmentResponse } from "@/lib/api/types";

import { FratSignoffs } from "./frat-signoffs";

function frat(over: Partial<FratAssessmentResponse> = {}): FratAssessmentResponse {
  return {
    id: "frat-1",
    flight_id: "f-1",
    pilot_user_id: "u-pilot",
    answers: { pilot_rest: 1 },
    total_score: 1,
    risk_level: "low",
    mitigations: null,
    over_limit_factors: [],
    carried_from_assessment_id: null,
    affirmed_zero_factors: null,
    created_at: "2026-10-30T16:00:00Z",
    authorizations: [],
    signoffs: [],
    verification: null,
    ...over,
  };
}

beforeEach(() => {
  sign.mockClear();
});

describe("FratSignoffs (#155)", () => {
  it("lets a dispatcher sign the dispatcher's box, for the FRAT on screen", async () => {
    const user = userEvent.setup();
    render(
      <FratSignoffs
        flightId="f-1"
        frat={frat()}
        timeZone="America/Anchorage"
        canSign={{ pilot: false, dispatcher: true }}
      />,
    );
    // The pilot signs after dispatch (#175).
    expect(screen.getByLabelText("Sign the FRAT as the pilot")).toBeDisabled();
    expect(screen.getByText("— after dispatch signs")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Sign the FRAT as the dispatcher"));
    expect(sign).toHaveBeenCalledWith("f-1", "frat-1", "dispatcher", false);
  });

  it("lists the dispatcher's box first, and holds it until the flight is built (#175)", () => {
    render(
      <FratSignoffs
        flightId="f-1"
        frat={frat()}
        timeZone="America/Anchorage"
        canSign={{ pilot: false, dispatcher: true }}
        buildGaps={["No PIC on the flight yet."]}
      />,
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Sign the FRAT as the dispatcher",
      "Sign the FRAT as the pilot",
    ]);
    expect(screen.getByLabelText("Sign the FRAT as the dispatcher")).toBeDisabled();
    expect(screen.getByText("— once the flight is built")).toBeInTheDocument();
    expect(screen.getByText("No PIC on the flight yet.")).toBeInTheDocument();
  });

  it("lets the pilot sign once dispatch has (#175)", async () => {
    const user = userEvent.setup();
    render(
      <FratSignoffs
        flightId="f-1"
        frat={frat({
          signoffs: [
            {
              role: "dispatcher",
              user_id: "u-disp",
              signer_name: "Dana Dispatch",
              signed_at: "2026-10-30T16:05:00Z",
              flight_minutes_today: null,
              flight_minutes_remaining: null,
            },
          ],
        })}
        timeZone="America/Anchorage"
        canSign={{ pilot: true, dispatcher: false }}
      />,
    );
    await user.click(screen.getByLabelText("Sign the FRAT as the pilot"));
    expect(sign).toHaveBeenCalledWith("f-1", "frat-1", "pilot", false);
  });

  it("shows who signed, when, the pilot's minutes and the audit trail ID", () => {
    render(
      <FratSignoffs
        flightId="f-1"
        frat={frat({
          signoffs: [
            {
              role: "pilot",
              user_id: "u-pilot",
              signer_name: "Tomas Pilot",
              signed_at: "2026-10-30T16:05:00Z",
              flight_minutes_today: 95,
              flight_minutes_remaining: 385,
            },
            {
              role: "dispatcher",
              user_id: "u-d",
              signer_name: "Dana Dispatch",
              signed_at: "2026-10-30T16:10:00Z",
            },
          ],
          verification: { complete: true, intact: true, record_hash: "7f3a91c20b4e" + "0".repeat(52), code: "7F3A-91C2-0B4E" },
        })}
        timeZone="America/Anchorage"
        canSign={{ pilot: true, dispatcher: true }}
      />,
    );
    expect(screen.getByLabelText("Sign the FRAT as the pilot")).toBeChecked();
    expect(screen.getByText(/signed by Tomas Pilot, Oct 30, 08:05 AKDT \(16:05Z\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 h 35 min flown, 6 h 25 min remaining/)).toBeInTheDocument();
    expect(screen.getByText("Signed by both. Audit trail ID 7F3A-91C2-0B4E.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Signed FRAT (PDF) ›" })).toHaveAttribute("href", "/api/frat/f-1/pdf");
  });

  it("says when the record no longer matches what was signed", () => {
    render(
      <FratSignoffs
        flightId="f-1"
        frat={frat({ verification: { complete: true, intact: false, record_hash: "x", code: "X" } })}
        timeZone="UTC"
        canSign={{ pilot: false, dispatcher: false }}
      />,
    );
    expect(screen.getByText(/no longer matches what was signed/)).toBeInTheDocument();
  });

  it("can't be signed once the flight is released", () => {
    render(
      <FratSignoffs
        flightId="f-1"
        frat={frat({ locked: true })}
        timeZone="UTC"
        canSign={{ pilot: true, dispatcher: true }}
      />,
    );
    expect(screen.getByLabelText("Sign the FRAT as the pilot")).toBeDisabled();
    expect(screen.getByLabelText("Sign the FRAT as the dispatcher")).toBeDisabled();
  });
});

/**
 * 17 Nov, the client: "Pilot review should allow the pilot to change the
 * scale on any of the items. If they do change the frat, the dispatcher
 * should be alerted to those changes and then require signing again after
 * the changes have been acknowledged." The pilot's change is their
 * signature; the dispatcher's box lists what changed and opens once they
 * say they have reviewed it.
 */
describe("FratSignoffs: the pilot's change (17 Nov)", () => {
  const pilotSigned = {
    role: "pilot" as const,
    user_id: "u-pilot",
    signer_name: "Tomas Pilot",
    signed_at: "2026-11-17T18:20:00Z",
    flight_minutes_today: 0,
    flight_minutes_remaining: 480,
  };
  const pilotChange = frat({
    id: "frat-2",
    filed_by_user_id: "u-pilot",
    answers: { pilot_rest: 3, wx_wind: 2 },
    mitigations: "Leaving before the front",
    signoffs: [pilotSigned],
    changes: {
      by_role: "pilot",
      by_name: "Tomas Pilot",
      at: "2026-11-17T18:20:00Z",
      since_assessment_id: "frat-1",
      since_filed_at: "2026-11-17T18:05:00Z",
      since_signed_at: "2026-11-17T18:05:30Z",
      factors: [
        { code: "wx_wind", before: 0, after: 2 },
        { code: "pilot_rest", before: 1, after: 3 },
      ],
      mitigations_before: null,
      mitigations_after: "Leaving before the front",
    },
  });

  it("lists what the pilot changed and opens dispatch's box once it's reviewed", async () => {
    const user = userEvent.setup();
    render(
      <FratSignoffs
        flightId="f-1"
        frat={pilotChange}
        timeZone="UTC"
        canSign={{ pilot: false, dispatcher: true }}
      />,
    );
    expect(
      screen.getByText("Tomas Pilot changed the FRAT Nov 17, 18:20 UTC (18:20Z) and signed it. Since dispatch signed it:"),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "The pilot's changes" });
    expect(Array.from(list.querySelectorAll("li"), (li) => li.textContent)).toEqual([
      "Rest in last 24h: 1 → 3",
      "Wind & gusts: 0 → 2",
      "Mitigation added: “Leaving before the front”",
    ]);
    const box = screen.getByLabelText("Sign the FRAT as the dispatcher");
    expect(box).toBeDisabled();
    expect(screen.getByText("— review the pilot's changes, then sign")).toBeInTheDocument();
    await user.click(screen.getByLabelText("I've reviewed the pilot's changes"));
    expect(box).toBeEnabled();
    await user.click(box);
    expect(sign).toHaveBeenCalledWith("f-1", "frat-2", "dispatcher", true);
  });

  it("shows the pilot signed it as they filed it", () => {
    render(
      <FratSignoffs flightId="f-1" frat={pilotChange} timeZone="UTC" canSign={{ pilot: true, dispatcher: false }} />,
    );
    expect(
      screen.getByText("signed by Tomas Pilot as they filed it, Nov 17, 18:20 UTC (18:20Z)"),
    ).toBeInTheDocument();
    // Only a dispatcher ticks the review.
    expect(screen.queryByLabelText("I've reviewed the pilot's changes")).not.toBeInTheDocument();
  });

  it("lets the pilot sign their own FRAT first, before dispatch", async () => {
    const user = userEvent.setup();
    render(
      <FratSignoffs
        flightId="f-1"
        frat={frat({ filed_by_user_id: "u-pilot" })}
        timeZone="UTC"
        canSign={{ pilot: true, dispatcher: false }}
      />,
    );
    await user.click(screen.getByLabelText("Sign the FRAT as the pilot"));
    expect(sign).toHaveBeenCalledWith("f-1", "frat-1", "pilot", false);
  });

  it("lists what dispatch changed since the pilot signed, in the pilot's box", () => {
    render(
      <FratSignoffs
        flightId="f-1"
        frat={frat({
          id: "frat-3",
          filed_by_user_id: "u-disp",
          signoffs: [
            {
              role: "dispatcher",
              user_id: "u-disp",
              signer_name: "Dana Dispatch",
              signed_at: "2026-11-17T19:00:30Z",
              flight_minutes_today: null,
              flight_minutes_remaining: null,
            },
          ],
          changes: {
            by_role: "dispatcher",
            by_name: "Dana Dispatch",
            at: "2026-11-17T19:00:00Z",
            since_assessment_id: "frat-2",
            since_filed_at: "2026-11-17T18:20:00Z",
            since_signed_at: "2026-11-17T18:20:00Z",
            factors: [{ code: "wx_wind", before: 2, after: 4 }],
            mitigations_before: null,
            mitigations_after: null,
          },
        })}
        timeZone="UTC"
        canSign={{ pilot: true, dispatcher: false }}
      />,
    );
    expect(
      screen.getByText("Dana Dispatch changed the FRAT Nov 17, 19:00 UTC (19:00Z). Since the pilot signed it:"),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Dispatch's changes" });
    expect(list.textContent).toBe("Wind & gusts: 2 → 4");
    // The pilot signs again as before, with no tick of their own.
    expect(screen.getByLabelText("Sign the FRAT as the pilot")).toBeEnabled();
  });
});

