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
    expect(screen.getByLabelText("Sign the FRAT as the pilot")).toBeDisabled();
    expect(screen.getByText("— waiting for the pilot")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Sign the FRAT as the dispatcher"));
    expect(sign).toHaveBeenCalledWith("f-1", "frat-1", "dispatcher");
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
