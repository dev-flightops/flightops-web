import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DispatchRisk, RiskRow, StopWeather } from "@/lib/api/dispatch-risk";
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
    expect(screen.getByText("Waiting for the Chief Pilot or the DO. They have a bell alert.")).toBeInTheDocument();
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

/**
 * A HIGH risk (#155) names its reasons from the packet the page scored
 * (17 Nov): a FRAT filed LOW sat behind "Risk HIGH — needs the Chief Pilot
 * or DO" with nothing to say why. A Bethel report hadn't come through.
 */
describe("the packet's HIGH risk, and why", () => {
  const high = (over: Partial<FratOverLimits> = {}) =>
    view({
      flight_number: "TST742",
      over_limit_factors: [],
      mitigations: null,
      high_risk: true,
      risk_level: "low",
      packet_level: "high",
      management_required: false,
      waiting: true,
      ...over,
    });

  const row = (factor: string, level: RiskRow["level"], comment: string): RiskRow => ({
    factor,
    severity: null,
    likelihood: null,
    score: level === "HIGH" ? 16 : level === "LOW" ? 4 : null,
    level,
    comment,
    source: "auto",
  });

  const stop = (ident: string, source: StopWeather["source"]): StopWeather => ({
    ident,
    source,
    certified: source === "metar",
    described: source === null ? "no weather" : "METAR",
    ceiling_ft: null,
    ceiling_from: null,
    visibility_sm: null,
    visibility_from: null,
    wind_direction: null,
    wind_kt: null,
    wind_gust_kt: null,
    wind_from: null,
  });

  function scored(over: Partial<DispatchRisk> = {}, inputs: Partial<DispatchRisk["inputs"]> = {}): DispatchRisk {
    return {
      flight_id: "f-1",
      level: "HIGH",
      max_score: 16,
      management_required: false,
      concerns: [],
      summary: "",
      rows: [
        row(
          "Ceiling / Visibility",
          "HIGH",
          "worst route METAR vis≈10.0SM at PACM; no weather at PABE, scored unknown",
        ),
        row("Surface Wind (incl gust)", "LOW", "max wind 11 kt"),
        row("Outside Pilot Restrictions", null, "within pilot restrictions"),
        row("<4 hrs until MX", null, "maintenance within 4 hrs=No (100-hour inspection due in 53.6 h)"),
      ],
      stops: [stop("PABE", null), stop("PACM", "metar")],
      inputs: {
        flight_id: "f-1",
        outside_pilot_restrictions: false,
        vfr_mountain_night: false,
        management_approval_obtained: false,
        hazmat_approved: false,
        mel_actions_complete: false,
        reporting_override: null,
        night_override: null,
        crosswind_override_kt: null,
        maintenance_override: null,
        mel_override: null,
        mel_actions_override: null,
        hazmat_override: null,
        non_certified_notes: null,
        dispatcher_notes: null,
        area_forecast_product: null,
        updated_by: null,
        updated_at: null,
        ...inputs,
      },
      automatic: {
        reporting: { value: true, note: "" },
        night: { value: false, note: "" },
        crosswind_kt: 5,
        maintenance: { value: false, note: "100-hour inspection due in 53.6 h" },
        mel: { value: false, note: "" },
        hazmat: { value: false, note: "" },
      },
      ...over,
    };
  }

  const reasons = () =>
    screen.queryByRole("list", { name: "Why the packet asks for approval" })
      ? Array.from(
          screen.getByRole("list", { name: "Why the packet asks for approval" }).querySelectorAll("li"),
          (li) => li.textContent,
        )
      : [];

  it("names the rows scored HIGH and the stop no weather reached", () => {
    render(<FratOverLimitsPanel view={high()} risk={scored()} canAccept={false} />);
    expect(screen.getByText("Risk HIGH — needs the Chief Pilot or DO")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The risk is HIGH: the dispatch packet scores it HIGH. The Chief Pilot or DO approves the flight before it is released.",
      ),
    ).toBeInTheDocument();
    expect(reasons()).toEqual([
      "Ceiling / Visibility: worst route METAR vis≈10.0SM at PACM; no weather at PABE, scored unknown",
    ]);
    expect(
      screen.getByText(
        "No current weather for PABE: the packet scores weather it can't see as HIGH. If a report didn't come through, reload the page to fetch the weather again.",
      ),
    ).toBeInTheDocument();
  });

  it("names what set the Management Approval Flag, in the packet's own words", () => {
    const risk = scored(
      {
        level: "LOW",
        max_score: 4,
        management_required: true,
        stops: [stop("PABE", "metar")],
        rows: [
          row("Ceiling / Visibility", "LOW", "worst route METAR vis≈10.0SM at PABE"),
          row(
            "<4 hrs until MX",
            null,
            "maintenance within 4 hrs=Unknown (no inspection due by hours on file: answer from the aircraft's records, or enter its 100-hour or phase inspection on the due list)",
          ),
        ],
        automatic: {
          ...scored().automatic,
          maintenance: { value: null, note: "no inspection due by hours on file" },
        },
      },
    );
    render(
      <FratOverLimitsPanel
        view={high({ packet_level: "low", management_required: true })}
        risk={risk}
        canAccept={false}
      />,
    );
    expect(reasons()).toEqual([
      "<4 hrs until MX: maintenance within 4 hrs=Unknown (no inspection due by hours on file: answer from the aircraft's records, or enter its 100-hour or phase inspection on the due list)",
    ]);
    expect(screen.queryByText(/No current weather/)).not.toBeInTheDocument();
  });

  it("names a dispatcher's Yes once, without repeating the factor", () => {
    const risk = scored(
      {
        management_required: true,
        stops: [stop("PABE", "metar")],
        rows: [
          row("Ceiling / Visibility", "LOW", "worst route METAR vis≈10.0SM at PABE"),
          row("Outside Pilot Restrictions", "HIGH", "outside pilot restrictions"),
          row("<4 hrs until MX", null, "maintenance within 4 hrs=No (100-hour inspection due in 53.6 h)"),
        ],
      },
      { outside_pilot_restrictions: true },
    );
    render(<FratOverLimitsPanel view={high({ management_required: true })} risk={risk} canAccept={false} />);
    expect(reasons()).toEqual(["Outside Pilot Restrictions"]);
  });

  it("takes the dispatcher's maintenance answer over the system's", () => {
    const risk = scored(
      {
        level: "LOW",
        max_score: 4,
        management_required: true,
        stops: [stop("PABE", "metar")],
        rows: [row("<4 hrs until MX", null, "maintenance within 4 hrs=Yes")],
      },
      { maintenance_override: true },
    );
    render(
      <FratOverLimitsPanel
        view={high({ packet_level: "low", management_required: true })}
        risk={risk}
        canAccept={false}
      />,
    );
    expect(reasons()).toEqual(["<4 hrs until MX: maintenance within 4 hrs=Yes"]);
  });

  it("says no more than the sentence where the page's score disagrees, or there is none", () => {
    const { unmount } = render(
      <FratOverLimitsPanel view={high()} risk={scored({ level: "LOW", max_score: 4 })} canAccept={false} />,
    );
    expect(reasons()).toEqual([]);
    expect(screen.queryByText(/No current weather/)).not.toBeInTheDocument();
    unmount();
    // The FRAT page doesn't score the packet.
    render(<FratOverLimitsPanel view={high()} canAccept={false} />);
    expect(screen.getByText(/^The risk is HIGH: the dispatch packet scores it HIGH\./)).toBeInTheDocument();
    expect(reasons()).toEqual([]);
  });

  it("keeps the reasons beside an approval", () => {
    render(
      <FratOverLimitsPanel
        view={high({
          waiting: false,
          high_risk_approved: {
            id: "auth-2",
            frat_assessment_id: "a-1",
            kind: "high_risk_approved",
            authorizer_name: "Dana Ops",
            authorizer_role: "Director of Operations",
            authorizer_cert_number: null,
            notes: "Bethel METAR came in VFR",
            authorized_at: "2026-11-17T18:20:00Z",
          },
        })}
        risk={scored()}
        canAccept
      />,
    );
    expect(screen.getByText("Risk HIGH — approved")).toBeInTheDocument();
    expect(reasons()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Approve the flight" })).not.toBeInTheDocument();
  });
});
