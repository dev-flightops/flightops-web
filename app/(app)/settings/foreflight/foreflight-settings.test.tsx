import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  saveForeFlightKeyAction: vi.fn(),
  setForeFlightSendingAction: vi.fn(),
  checkForeFlightAction: vi.fn(),
  sendToForeFlightAction: vi.fn(),
  disconnectForeFlightAction: vi.fn(),
}));
vi.mock("./actions", () => actions);

import type { ForeFlightConnection } from "@/lib/api/integrations";

import { ForeFlightSettings } from "./foreflight-settings";

/** The company's ForeFlight connection (#54). */

const NOT_CONNECTED: ForeFlightConnection = {
  has_key: false,
  send_flights: false,
  account_name: null,
  checked_at: null,
  last_sync_at: null,
  last_error: null,
  legs: {},
  problems: [],
  updated_by: null,
  updated_at: null,
};

const CONNECTED: ForeFlightConnection = {
  ...NOT_CONNECTED,
  has_key: true,
  send_flights: true,
  account_name: "Demo Air Ops",
  checked_at: "2026-10-07T08:00:00Z",
  last_sync_at: "2026-10-07T08:05:00Z",
  legs: { sent: 4, frozen: 1, failed: 1 },
  problems: [
    {
      flight_id: "f-1",
      flight_number: "PGR900",
      leg_sequence: 2,
      departs_at: "2026-10-08T16:00:00Z",
      state: "failed",
      message: "N200PA isn't in the company's ForeFlight aircraft",
    },
  ],
};

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
});

describe("ForeFlightSettings (#54)", () => {
  it("takes a key, checks it at once and names what won't match", async () => {
    actions.saveForeFlightKeyAction.mockResolvedValue({
      ok: true,
      value: {
        error: null,
        account_name: "Demo Air Ops",
        aircraft: 3,
        crew: 9,
        tails_missing: ["N200PA"],
        crew_missing: [{ name: "Bob Henderson", email: "bob@peregrine.local" }],
      },
    });
    render(<ForeFlightSettings connection={NOT_CONNECTED} />);
    expect(screen.getByText("Not connected")).toBeTruthy();
    // Nothing to send with until there's a key.
    expect((screen.getByRole("button", { name: "Turn on" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Send now" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("ForeFlight API key"), { target: { value: "ff-key-0123456789" } });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));
    await waitFor(() => expect(actions.saveForeFlightKeyAction).toHaveBeenCalledWith("ff-key-0123456789"));
    expect(await screen.findByText(/3 aircraft and 9 crew there/)).toBeTruthy();
    expect(screen.getByText(/N200PA\. Add them to the company/)).toBeTruthy();
    expect(screen.getByText(/Bob Henderson \(bob@peregrine\.local\)/)).toBeTruthy();
    // The key isn't kept in the page once saved.
    expect((screen.getByLabelText("ForeFlight API key") as HTMLInputElement).value).toBe("");
  });

  it("shows where sending stands, sends now, and lists the legs that need attention", async () => {
    actions.sendToForeFlightAction.mockResolvedValue({
      ok: true,
      value: { error: null, created: 2, updated: 1, unchanged: 3, frozen: 0, removed: 0, failed: 0, problems: [] },
    });
    render(<ForeFlightSettings connection={CONNECTED} />);
    expect(screen.getByText("Connected to Demo Air Ops")).toBeTruthy();
    expect(screen.getByText(/4 legs up to date, 1 released/)).toBeTruthy();
    expect(screen.getByText("N200PA isn't in the company's ForeFlight aircraft")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Send now" }));
    expect(await screen.findByText("Legs: 2 created, 1 updated, 3 unchanged.")).toBeTruthy();

    actions.setForeFlightSendingAction.mockResolvedValue({ ok: false, error: "Save the API key first." });
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(actions.setForeFlightSendingAction).toHaveBeenCalledWith(false));
    expect((await screen.findByRole("alert")).textContent).toBe("Save the API key first.");
  });

  it("asks before disconnecting", async () => {
    actions.disconnectForeFlightAction.mockResolvedValue({ ok: true, value: null });
    render(<ForeFlightSettings connection={CONNECTED} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect…" }));
    expect(screen.getByText(/Flights already sent stay in ForeFlight/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(actions.disconnectForeFlightAction).toHaveBeenCalled());
  });
});
