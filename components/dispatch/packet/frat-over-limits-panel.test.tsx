import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FratOverLimits } from "@/lib/api/types";

vi.mock("@/app/(app)/dispatch/frat-actions", () => ({ acceptOverLimitsAction: vi.fn() }));
// Next runs the forms on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import { FratOverLimitsPanel } from "./frat-over-limits-panel";

/**
 * A FRAT filed over company limits on the packet (#152). The client, 29 Oct:
 * "a manager override at this step. Sends a ping to chief pilot/DO for an
 * acceptance."
 */
function view(over: Partial<FratOverLimits> = {}): FratOverLimits {
  return {
    flight_id: "9c0d43c4-73ef-4881-8f4d-f8b8447ec06c",
    flight_number: "MM1122",
    scheduled_departure_at: "2026-10-30T17:33:00Z",
    assessment_id: "a-1",
    pilot_name: "Bob Henderson",
    over_limit_factors: ["wx_wind"],
    mitigations: "Planning to use runway 12. only 8-13kt cross wind.",
    filed_at: "2026-10-30T16:00:00Z",
    accepted: null,
    ...over,
  };
}

describe("the packet's FRAT over company limits (#152)", () => {
  it("asks the Chief Pilot or DO why it can go", () => {
    render(<FratOverLimitsPanel view={view()} canAccept />);
    expect(screen.getByText("FRAT over company limits — no-go until accepted")).toBeInTheDocument();
    expect(
      screen.getByText(/^Bob Henderson filed the FRAT Oct 30, 16:00Z with .+ out of company limits\.$/),
    ).toBeInTheDocument();
    expect(screen.getByText("Mitigation: “Planning to use runway 12. only 8-13kt cross wind.”")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeRequired();
    expect(screen.getByRole("button", { name: "Accept over company limits" })).toBeInTheDocument();
  });

  it("tells everyone else who it waits for", () => {
    render(<FratOverLimitsPanel view={view()} canAccept={false} />);
    expect(screen.getByText("Waiting for the Chief Pilot or the DO to accept it. They have a bell alert.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept over company limits" })).not.toBeInTheDocument();
  });

  it("names who accepted it, when and why", () => {
    render(
      <FratOverLimitsPanel
        canAccept
        view={view({
          accepted: {
            id: "auth-1",
            frat_assessment_id: "a-1",
            kind: "over_limits_accepted",
            authorizer_name: "Dan Ops",
            authorizer_role: "Director of Operations",
            authorizer_cert_number: null,
            notes: "Runway 12 keeps it in limits",
            authorized_at: "2026-10-30T16:20:00Z",
          },
        })}
      />,
    );
    expect(screen.getByText("FRAT over company limits — accepted")).toBeInTheDocument();
    expect(
      screen.getByText("Accepted by Dan Ops (Director of Operations), Oct 30, 16:20Z: “Runway 12 keeps it in limits”"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept over company limits" })).not.toBeInTheDocument();
  });
});
