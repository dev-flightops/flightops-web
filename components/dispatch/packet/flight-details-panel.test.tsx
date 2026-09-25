import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The PIC picker nested in this panel imports server actions, which
// pull next-auth into the module graph. Same mocks as crew-panel's.
vi.mock("@/app/(app)/dispatch/crew-actions", () => ({
  assignCrewAction: vi.fn(),
  unassignCrewAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import type { FlightDetail } from "@/lib/api/types";

import { FlightDetailsPanel } from "./flight-details-panel";

/**
 * Client bug report, 24 September:
 *
 *   On flight PGR324 the dispatcher can select the flight. The next box
 *   down allows you to select a caravan, but the flight is assigned to
 *   a 207.
 *
 * PGR324 is N806PA, a Cessna 207 Skywagon. The panel showed
 * "208 (Caravan)" because only two of the operator's five airframe
 * labels had been ported; nothing matched the 207, and a <select> with
 * no matching option renders its first one.
 */
const flight = (
  aircraft: Partial<FlightDetail["aircraft"]> = {},
): FlightDetail =>
  ({
    id: "f-1",
    flight_number: "PGR324",
    origin: "PAVA",
    destination: "PABE",
    scheduled_departure_at: "2026-09-24T15:00:00Z",
    scheduled_arrival_at: "2026-09-24T16:00:00Z",
    status: "released",
    pax_count: 10,
    cargo_lbs: 810,
    notes: null,
    aircraft: {
      id: "ac-1",
      tail_number: "N806PA",
      model: "Cessna 207 Skywagon",
      seats: 6,
      airframe_type: "c207",
      ...aircraft,
    },
  }) as FlightDetail;

function panel(f: FlightDetail | null) {
  render(
    <FlightDetailsPanel
      flight={f}
      picOptions={[]}
      currentPicId={null}
      flightId={f?.id ?? null}
    />,
  );
}

describe("the packet's airframe", () => {
  it("shows the 207 the flight is actually assigned", () => {
    // The reported bug, exactly.
    panel(flight());
    expect(screen.getByTestId("packet-airframe")).toHaveTextContent("207");
    expect(screen.getByTestId("packet-airframe")).not.toHaveTextContent(
      /Caravan/,
    );
  });

  it("names the tail it came from", () => {
    // So a dispatcher can see it is derived rather than chosen.
    panel(flight());
    expect(screen.getByTestId("packet-airframe")).toHaveTextContent("N806PA");
  });

  it.each([
    ["c207", "Cessna 207 Skywagon", "207"],
    ["caravan", "Cessna 208 Caravan", "208 (Caravan)"],
    ["caravan", "Cessna 208B Grand Caravan", "208 (Caravan)"],
    ["ga8", "GippsAero GA8 Airvan", "GA8"],
    ["navajo", "Piper PA-31 Navajo", "PA31"],
    ["kingair", "Beechcraft 1900D", "1900D (Beech)"],
    ["kingair", "Beechcraft King Air 200", "King Air"],
  ])(
    "maps %s / %s to %s",
    (airframeType, model, expected) => {
      // Every airframe in the operator's fleet. Six of the eight models
      // used to render as "208 (Caravan)".
      panel(flight({ airframe_type: airframeType, model }));
      expect(screen.getByTestId("packet-airframe")).toHaveTextContent(
        expected,
      );
    },
  );

  it("trusts airframe_type over the model text", () => {
    // The structured field wins, and this is the case that proves it:
    // a 207 whose model string says nothing about a 207. Model text is
    // free-form, so matching on it is what produced the original bug —
    // without this test, dropping the airframe_type switch entirely
    // still passes, because the model fallbacks happen to cover the
    // current fleet.
    panel(flight({ airframe_type: "c207", model: "Skywagon II" }));
    expect(screen.getByTestId("packet-airframe")).toHaveTextContent("207");
  });

  it("falls back to the model when airframe_type is null", () => {
    // One fleet row has no airframe_type. Model text is the fallback,
    // not a default — a default is how this bug happened.
    panel(flight({ airframe_type: null, model: "208 Caravan" }));
    expect(screen.getByTestId("packet-airframe")).toHaveTextContent(
      "208 (Caravan)",
    );
  });

  it("shows an unknown airframe as itself rather than as a Caravan", () => {
    // The property that matters: never display a type the aircraft is
    // not. An unrecognised airframe reads as its own model.
    panel(
      flight({ airframe_type: "quadjet", model: "Bombardier Global 7500" }),
    );
    const shown = screen.getByTestId("packet-airframe");
    expect(shown).toHaveTextContent("Bombardier Global 7500");
    expect(shown).not.toHaveTextContent(/Caravan/);
  });

  it("offers no editable airframe control once a flight is loaded", () => {
    // The airframe is the assigned tail's. The old dropdown captured
    // nothing — no form, no name, no submit — so it claimed a choice
    // that did not exist.
    panel(flight());
    expect(
      screen.queryByRole("combobox", { name: /aircraft/i }),
    ).not.toBeInTheDocument();
  });

  it("offers the whole fleet on a hand-filled packet", () => {
    // No flight selected: the dispatcher is telling us what they are
    // flying, and legacy offered five choices where we shipped two.
    panel(null);
    const options = screen
      .getAllByRole("option")
      .map((o) => o.textContent);
    for (const label of [
      "207",
      "208 (Caravan)",
      "GA8",
      "PA31",
      "King Air",
    ]) {
      expect(options).toContain(label);
    }
  });
});
