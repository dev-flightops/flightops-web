import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MorningResponse } from "@/lib/api/ops";

const { pick, record, refresh } = vi.hoisted(() => ({ pick: vi.fn(), record: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({ pickAircraftAction: pick, recordPreflightAction: record }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { MorningAircraft } from "./morning-aircraft";

const OPTIONS: MorningResponse["options"] = [
  { aircraft_id: "a-1", tail_number: "N701PS", model: "Cessna 208B", base: "PABE", available: true, reason: null },
  { aircraft_id: "a-2", tail_number: "N702PS", model: "Cessna 208", base: "PANC", available: false, reason: "based at PANC, not PABE" },
];
const MINE = {
  id: "m-1",
  aircraft_id: "a-1",
  tail_number: "N701PS",
  pilot_user_id: "p-1",
  pilot_name: "Beth Nolan",
  company_date: "2026-10-31",
  picked_at: "2026-10-31T15:40:00Z",
  preflight_at: null,
  fuel_gallons: null,
  oil_quarts: null,
  notes: null,
  assigned_by_name: null,
};

function morning(over: Partial<MorningResponse>): MorningResponse {
  return { company_date: "2026-10-31", on_duty: true, mine: null, options: OPTIONS, ...over };
}

beforeEach(() => {
  pick.mockReset();
  record.mockReset();
  refresh.mockReset();
});

describe("MorningAircraft (#93)", () => {
  it("asks for duty in first", () => {
    render(<MorningAircraft morning={morning({ on_duty: false })} />);
    expect(screen.getByText(/Duty in, then take your aircraft for the day/)).toBeInTheDocument();
  });

  it("offers what may be taken and says why the rest can't be", async () => {
    pick.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<MorningAircraft morning={morning({})} />);
    expect(screen.getByRole("option", { name: /N702PS .*based at PANC, not PABE/ })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Take an aircraft"), "a-1");
    await user.click(screen.getByRole("button", { name: "Take it" }));
    expect(pick).toHaveBeenCalledWith("a-1");
    expect(refresh).toHaveBeenCalled();
  });

  it("records the preflight and run-up of the pilot's aircraft", async () => {
    record.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<MorningAircraft morning={morning({ mine: MINE })} />);
    expect(screen.getByText(/is yours today/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Fuel on board (gal)"), "60");
    await user.type(screen.getByLabelText("Oil (qt)"), "9");
    await user.click(screen.getByRole("button", { name: "Record preflight and run-up" }));
    expect(record).toHaveBeenCalledWith("m-1", { fuel_gallons: 60, oil_quarts: 9, notes: null });
  });

  it("says when the preflight is on record", () => {
    render(
      <MorningAircraft
        morning={morning({ mine: { ...MINE, preflight_at: "2026-10-31T16:05:00Z", fuel_gallons: "60.0", oil_quarts: "9.0" } })}
      />,
    );
    expect(screen.getByText(/preflight and run-up recorded at 08:05 AKDT \(60 gal, 9 qt oil\)/)).toBeInTheDocument();
  });

  it("shows the service's refusal", async () => {
    pick.mockResolvedValue({ ok: false, error: "N701PS isn't available: taken by Caleb Frost today." });
    const user = userEvent.setup();
    render(<MorningAircraft morning={morning({})} />);
    await user.selectOptions(screen.getByLabelText("Take an aircraft"), "a-1");
    await user.click(screen.getByRole("button", { name: "Take it" }));
    expect(await screen.findByText(/taken by Caleb Frost today/)).toBeInTheDocument();
  });
});
