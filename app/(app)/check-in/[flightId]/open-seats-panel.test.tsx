import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  refreshOpeningAction: vi.fn(),
  textOpeningAction: vi.fn(),
}));
vi.mock("./open-seats-actions", () => actions);

import type { Opening, OpeningPassenger, PassengerText } from "@/lib/api/open-seats";

import { howTold, OpenSeatsPanel } from "./open-seats-panel";

const FLIGHT = "6b0f6a3e-2c1d-4e5f-8a9b-0c1d2e3f4a5b";
const ZONE = "America/Anchorage";

function text(over: Partial<PassengerText> = {}): PassengerText {
  return {
    id: "t-1",
    to_name: "Sam Rider",
    to_phone: "(907) 555-0100",
    body: "Peregrine Air: a seat has opened…",
    status: "not_sent",
    reason: "no_account",
    sent_at: null,
    created_at: "2026-10-26T18:41:00Z",
    ...over,
  };
}

function person(name: string, over: Partial<OpeningPassenger> = {}): OpeningPassenger {
  return { id: name, name, boards_at: "PAHP", leaves_at: "PABE", phone: "(907) 555-0100", text: null, ...over };
}

function opening(over: Partial<Opening> = {}): Opening {
  return {
    flight_id: FLIGHT,
    flight_number: "PGR900",
    tail_number: "N503PA",
    scheduled_departure_at: "2026-10-26T18:00:00Z",
    stops: ["PABE", "PAVA", "PAHP", "PABE"],
    legs: [
      { origin: "PAVA", destination: "PAHP", open: 5 },
      { origin: "PAHP", destination: "PABE", open: 1 },
    ],
    no_shows: [person("Rider, C1", { boards_at: "PAVA" })],
    waiting: [
      person("Rider, Sam", { text: text() }),
      person("Rider, Nell", { phone: null }),
      person("Rider, Wanda", { text: text({ status: "sent", reason: null, sent_at: "2026-10-26T18:41:00Z" }) }),
    ],
    occurred_at: "2026-10-26T18:40:00Z",
    can_text: false,
    ...over,
  };
}

beforeEach(() => {
  actions.refreshOpeningAction.mockReset().mockResolvedValue({ opening: opening() });
  actions.textOpeningAction.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the seats a no-show opened, on the gate page (#120)", () => {
  it("names the legs, the no-show, and how each waiting passenger was told", () => {
    render(<OpenSeatsPanel flightId={FLIGHT} initial={opening()} canAct timeZone={ZONE} />);
    const panel = screen.getByRole("region", { name: "Seats open" });
    expect(within(panel).getByText("PAVA → PAHP: 5 open · PAHP → PABE: 1 open")).toBeTruthy();
    expect(within(panel).getByText("No-show: Rider, C1 (PAVA → PABE)")).toBeTruthy();
    const waiting = within(panel).getByRole("list", { name: "Waiting for a seat" });
    expect(within(waiting).getByText("Text kept, not sent: no text-message account")).toBeTruthy();
    expect(within(waiting).getByText("No phone: call them")).toBeTruthy();
    expect(within(waiting).getByText("Texted 10:41 AKDT")).toBeTruthy();
    // No account yet: the texts wait, and nothing to press. #138: the
    // notice names the real page, and who sets it up.
    expect(
      within(panel).getByText(
        /The company’s text-message account isn’t set, so these texts are kept, not sent\. Ask an Exec Admin or the Director of Operations to set it under Settings → Text Messages\./,
      ),
    ).toBeTruthy();
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  it("sends the texts not yet gone once there is an account", async () => {
    const sent = opening({
      can_text: true,
      waiting: [person("Rider, Sam", { text: text({ status: "sent", reason: null, sent_at: "2026-10-26T18:45:00Z" }) })],
    });
    actions.textOpeningAction.mockResolvedValue({ opening: sent });
    render(<OpenSeatsPanel flightId={FLIGHT} initial={opening({ can_text: true })} canAct timeZone={ZONE} />);
    // Sam's kept text; Nell has no number; Wanda's went.
    fireEvent.click(screen.getByRole("button", { name: "Send the text" }));
    await waitFor(() => expect(screen.getByText("Texted 10:45 AKDT")).toBeTruthy());
    expect(actions.textOpeningAction).toHaveBeenCalledWith(FLIGHT);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says why texts didn't go, keeping what it shows", async () => {
    actions.textOpeningAction.mockResolvedValue({ error: "Your account can't send these texts." });
    render(<OpenSeatsPanel flightId={FLIGHT} initial={opening({ can_text: true })} canAct timeZone={ZONE} />);
    fireEvent.click(screen.getByRole("button", { name: "Send the text" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Your account can't send these texts."));
    expect(screen.getByText("PAVA → PAHP: 5 open · PAHP → PABE: 1 open")).toBeTruthy();
  });

  it("offers no sending to someone who only looks", () => {
    render(<OpenSeatsPanel flightId={FLIGHT} initial={opening({ can_text: true })} canAct={false} timeZone={ZONE} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("looks again every 20 seconds, and goes when the seats are taken", async () => {
    vi.useFakeTimers();
    actions.refreshOpeningAction.mockResolvedValue({ opening: null });
    render(<OpenSeatsPanel flightId={FLIGHT} initial={opening()} canAct timeZone={ZONE} />);
    expect(screen.getByRole("region", { name: "Seats open" })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(actions.refreshOpeningAction).toHaveBeenCalledWith(FLIGHT);
    expect(screen.queryByRole("region", { name: "Seats open" })).toBeNull();
  });

  it("shows nothing for a flight with no seat open", () => {
    const { container } = render(<OpenSeatsPanel flightId={FLIGHT} initial={null} canAct timeZone={ZONE} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("howTold", () => {
  it("covers every way a text can stand", () => {
    expect(howTold(person("a", { text: text({ reason: "phone_not_usable" }) }), ZONE)).toBe(
      "Number can't be texted: call them",
    );
    expect(howTold(person("b", { text: text({ status: "failed", reason: "Twilio answered 400" }) }), ZONE)).toBe(
      "Text failed: Twilio answered 400",
    );
    expect(howTold(person("c"), ZONE)).toBe("Not texted yet");
  });
});
