import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeStepAction, returnFlightOverWeightAction } = vi.hoisted(() => ({
  completeStepAction: vi.fn(),
  returnFlightOverWeightAction: vi.fn(),
}));

vi.mock("./actions", () => ({
  completeStepAction,
  returnFlightOverWeightAction,
}));

import { WeightAndBalanceStep } from "./step-2-weight-balance";
import type { FlightDetail, WeightReturn } from "@/lib/api/types";

const FLIGHT = {
  id: "f-1",
  flight_number: "GV101",
  origin: "PANC",
  destination: "PADU",
  status: "released",
  pax_count: 9,
  cargo_lbs: 600,
  max_payload_lbs: 2000,
  aircraft: {
    id: "a-1",
    tail_number: "N100PA",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
} as unknown as FlightDetail;

const OPEN_RETURN: WeightReturn = {
  id: "wr-1",
  flight_id: "f-1",
  pilot_user_id: "u-1",
  pilot_name: "Pat Pilot",
  max_payload_lbs: "1750.0",
  note: "Two bags have to come off",
  created_at: "2026-08-25T12:00:00Z",
  resolved_at: null,
  resolved_by_user_id: null,
  is_open: true,
};

beforeEach(() => {
  completeStepAction.mockReset();
  returnFlightOverWeightAction.mockReset();
  completeStepAction.mockResolvedValue({ ok: true });
  returnFlightOverWeightAction.mockResolvedValue({
    ok: true,
    weightReturn: OPEN_RETURN,
  });
});

describe("the override is gone", () => {
  // Client bug report 8/24 and 8/25. These assertions are the point of
  // the change — if any of them start failing, the override came back.
  it("offers no supervisor override control anywhere in the step", () => {
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    // Asserted against controls, not prose: the intro copy deliberately
    // says "there is no override", and that sentence is a feature.
    expect(screen.queryByLabelText(/supervisor/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/override/i)).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/director of ops|chief pilot/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /over limits/i }),
    ).not.toBeInTheDocument();
    // Every textbox on the clean path must be a W&B field, never a
    // justification box.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("has no way to continue while over limits", async () => {
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    await user.click(screen.getByRole("radio", { name: /over limits/i }));

    // The forward button is not merely disabled — it is not rendered.
    expect(
      screen.queryByRole("button", { name: /continue to step 3/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send back to dispatch/i }),
    ).toBeInTheDocument();
  });

  it("never completes the step on the over-limits path", async () => {
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    await user.click(screen.getByRole("radio", { name: /over limits/i }));
    await user.type(screen.getByLabelText(/max payload/i), "1750");
    await user.click(
      screen.getByRole("button", { name: /send back to dispatch/i }),
    );

    expect(returnFlightOverWeightAction).toHaveBeenCalledTimes(1);
    expect(completeStepAction).not.toHaveBeenCalled();
  });
});

describe("within limits", () => {
  it("requires a verdict before the step can be completed", () => {
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    expect(
      screen.getByRole("button", { name: /continue to step 3/i }),
    ).toBeDisabled();
  });

  it("completes the step once the pilot confirms within limits", async () => {
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    await user.click(screen.getByRole("radio", { name: /within limits/i }));
    await user.click(
      screen.getByRole("button", { name: /continue to step 3/i }),
    );

    expect(completeStepAction).toHaveBeenCalledWith(
      "f-1",
      2,
      expect.objectContaining({ confirmed_within_limits: true }),
    );
    // The retired keys must not reappear in the payload.
    const payload = completeStepAction.mock.calls[0][2];
    expect(payload).not.toHaveProperty("supervisor_name");
    expect(payload).not.toHaveProperty("supervisor_note");
    expect(payload).not.toHaveProperty("over_limits");
  });
});

describe("returning the flight", () => {
  it("will not send without a payload figure", async () => {
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    await user.click(screen.getByRole("radio", { name: /over limits/i }));
    expect(
      screen.getByRole("button", { name: /send back to dispatch/i }),
    ).toBeDisabled();
  });

  it("rejects a zero or negative figure", async () => {
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    await user.click(screen.getByRole("radio", { name: /over limits/i }));
    const field = screen.getByLabelText(/max payload/i);

    await user.type(field, "0");
    expect(
      screen.getByRole("button", { name: /send back to dispatch/i }),
    ).toBeDisabled();

    await user.clear(field);
    await user.type(field, "-40");
    expect(
      screen.getByRole("button", { name: /send back to dispatch/i }),
    ).toBeDisabled();
  });

  it("sends the figure and the note", async () => {
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    await user.click(screen.getByRole("radio", { name: /over limits/i }));
    await user.type(screen.getByLabelText(/max payload/i), "1750");
    await user.type(screen.getByLabelText(/note for dispatch/i), "Bags off");
    await user.click(
      screen.getByRole("button", { name: /send back to dispatch/i }),
    );

    expect(returnFlightOverWeightAction).toHaveBeenCalledWith("f-1", {
      max_payload_lbs: 1750,
      note: "Bags off",
    });
  });

  it("shows the returned state after sending", async () => {
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    await user.click(screen.getByRole("radio", { name: /over limits/i }));
    await user.type(screen.getByLabelText(/max payload/i), "1750");
    await user.click(
      screen.getByRole("button", { name: /send back to dispatch/i }),
    );

    expect(await screen.findByText(/returned to dispatch/i)).toBeInTheDocument();
    expect(screen.getByText(/1,750 lbs/)).toBeInTheDocument();
  });

  it("surfaces the conflict when another pilot already returned it", async () => {
    returnFlightOverWeightAction.mockResolvedValue({
      ok: false,
      error: "Pat Pilot already returned this flight at 1400 lbs",
    });
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} />,
    );
    await user.click(screen.getByRole("radio", { name: /over limits/i }));
    await user.type(screen.getByLabelText(/max payload/i), "900");
    await user.click(
      screen.getByRole("button", { name: /send back to dispatch/i }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Pat Pilot/);
    expect(alert).toHaveTextContent(/1400/);
  });
});

describe("an already-returned flight", () => {
  it("opens in the returned state rather than offering the form again", () => {
    render(
      <WeightAndBalanceStep
        flightId="f-1"
        flight={FLIGHT}
        openReturn={OPEN_RETURN}
      />,
    );
    expect(screen.getByText(/returned to dispatch/i)).toBeInTheDocument();
    expect(screen.getByText(/1,750 lbs/)).toBeInTheDocument();
    expect(screen.getByText(/Two bags have to come off/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue to step 3/i }),
    ).not.toBeInTheDocument();
  });

  it("lets the pilot revise the figure", async () => {
    const user = userEvent.setup();
    render(
      <WeightAndBalanceStep
        flightId="f-1"
        flight={FLIGHT}
        openReturn={OPEN_RETURN}
      />,
    );
    await user.click(screen.getByRole("button", { name: /revise/i }));
    // Comes back with the existing figure prefilled, not blank.
    expect(screen.getByLabelText(/max payload/i)).toHaveValue(1750);
  });
});

describe("the client's payload arithmetic (#111)", () => {
  const LOAD = {
    flight_id: "f-1",
    has_manifest: true,
    booked_passengers: 6,
    checked_in: { count: 5, weight_lbs: "960.0", baggage_lbs: "100.0" },
    to_check_in: { count: 1, weight_lbs: "180.0", baggage_lbs: "20.0" },
    cargo_lbs: "300.0",
    load: {
      useful_load_lbs: 3727,
      max_gross_weight_lbs: 9062,
      empty_weight_lbs: 5335,
      crew_lbs: "190",
      crew_basis: "standard" as const,
      crew_count: 1,
      fuel_lbs: "754",
      payload_lbs: "1560.0",
      remaining_lbs: "1223.0",
      fuel_counted: true,
      fuel_basis: "estimated" as const,
      fuel_estimate: {
        lbs: "754",
        gallons: "112.5",
        burn_gph: "54",
        fuel_type_code: "jet_a",
        flight_minutes: 40,
        round_trip: true,
        reserve_minutes: 45,
        missing: [],
      },
    },
  };

  const row = (label: string) => screen.getByRole("rowheader", { name: new RegExp(`^${label}`) }).closest("tr");

  it("deducts empty weight, pilot and recommended fuel from max gross", () => {
    render(<WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} load={LOAD} />);
    expect(row("Max gross weight")).toHaveTextContent("9,062 lb");
    expect(row("− Empty weight")).toHaveTextContent("5,335 lb");
    expect(row("− Pilot and crew")).toHaveTextContent("standard weight");
    expect(row("− Pilot and crew")).toHaveTextContent("190 lb");
    expect(row("− Fuel")).toHaveTextContent(
      "Fuel estimated: round trip, 40 min each way (no Jet A at the destination) + 45 min reserve at 54 gal/h = 112.5 gal of Jet A.",
    );
    expect(row("− Fuel")).toHaveTextContent("754 lb");
    expect(row("= Max payload")).toHaveTextContent("2,783 lb");
    // The aircraft's bare useful load is no longer shown as the max payload.
    expect(screen.queryByText("2,000 lbs")).toBeNull();
  });

  it("shows the checked-in passengers' weight, the rest, and the margin", () => {
    render(<WeightAndBalanceStep flightId="f-1" flight={FLIGHT} openReturn={null} load={LOAD} />);
    expect(row("Passengers checked in")).toHaveTextContent("5 at their weighed weights, 100 lb of it bags");
    expect(row("Passengers checked in")).toHaveTextContent("1,060 lb");
    expect(row("Still to check in")).toHaveTextContent("1 at their booked weights");
    expect(row("Cargo and mail")).toHaveTextContent("300 lb");
    expect(row("= Load")).toHaveTextContent("1,560 lb");
    expect(screen.getByText("1,223 lb under the max payload.")).toBeInTheDocument();
  });

  it("says how far over, in red", () => {
    render(
      <WeightAndBalanceStep
        flightId="f-1"
        flight={FLIGHT}
        openReturn={null}
        load={{ ...LOAD, load: { ...LOAD.load, remaining_lbs: "-140.0" } }}
      />,
    );
    expect(screen.getByText("Over the max payload by 140 lb.")).toHaveClass("text-status-red");
  });

  it("before a manifest, says there are no weights yet", () => {
    render(
      <WeightAndBalanceStep
        flightId="f-1"
        flight={FLIGHT}
        openReturn={null}
        load={{ ...LOAD, has_manifest: false }}
      />,
    );
    expect(row("Passengers")).toHaveTextContent("6 booked; no manifest yet, so no weights");
    expect(screen.queryByText(/under the max payload/)).toBeNull();
  });

  it("asks for the aircraft's weights when it has none", () => {
    render(
      <WeightAndBalanceStep
        flightId="f-1"
        flight={FLIGHT}
        openReturn={null}
        load={{ ...LOAD, load: { ...LOAD.load, useful_load_lbs: null } }}
      />,
    );
    expect(screen.getByText(/N100PA has no max gross and empty weight/)).toBeInTheDocument();
  });
});
