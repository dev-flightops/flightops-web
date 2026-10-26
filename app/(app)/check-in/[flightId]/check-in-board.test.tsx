import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CheckInPax, CheckInView } from "@/lib/api/check-in";

const actions = vi.hoisted(() => ({
  addWalkUpAction: vi.fn(),
  boardAction: vi.fn(),
  checkInAction: vi.fn(),
  closeBoardingAction: vi.fn(),
  noShowAction: vi.fn(),
  openBoardingAction: vi.fn(),
  promoteAction: vi.fn(),
  refreshAction: vi.fn(),
  resetAction: vi.fn(),
}));
vi.mock("./actions", () => actions);

import { CheckInBoard } from "./check-in-board";

function pax(over: Partial<CheckInPax> = {}): CheckInPax {
  return {
    id: "p-ana",
    first_name: "Ana",
    last_name: "Andrews",
    seat_number: null,
    ticket_type: "revenue",
    is_unaccompanied_minor: false,
    contact_phone: null,
    notes: null,
    weight_lbs: "180.0",
    baggage_lbs: "20.0",
    planned_weight_lbs: null,
    planned_baggage_lbs: null,
    bags_count: null,
    check_in_status: "booked",
    standby: false,
    id_verified: false,
    hazmat_declared: false,
    hazmat_notes: null,
    custom_fields: {},
    checked_in_at: null,
    checked_in_by_name: null,
    boarded_at: null,
    no_show_reason: null,
    no_show_notes: null,
    no_show_at: null,
    no_show_fee: null,
    ...over,
  };
}

function view(over: Partial<CheckInView> = {}): CheckInView {
  return {
    flight_id: "f-1",
    flight_number: "PGR801",
    origin: "PABE",
    destination: "PAEM",
    scheduled_departure_at: "2026-10-22T18:30:00Z",
    flight_status: "released",
    tail_number: "N806PA",
    manifest_id: "m-1",
    manifest_status: "draft",
    locked_at: null,
    boarding_opened_at: null,
    boarding_closed_at: null,
    rules: {
      require_actual_weight: false,
      require_actual_bag_weight: false,
      require_bags_count: true,
      require_id_verification: true,
      require_hazmat_declaration: true,
      require_seat_assignment: false,
      no_show_fee: "75.00",
      standby_enabled: true,
      allow_walk_up: true,
      lock_manifest_on_close: true,
    },
    fields: [
      {
        field_key: "village",
        field_label: "Home village",
        field_type: "dropdown",
        options: ["Bethel", "Emmonak"],
        is_required: true,
        help_text: null,
      },
    ],
    no_show_reasons: [
      { code: "did_not_appear", label: "Did not appear" },
      { code: "standby_no_seat", label: "Standby, no seat" },
      { code: "other", label: "Other" },
    ],
    passengers: [pax()],
    counts: { booked: 1, checked_in: 0, boarded: 0, no_show: 0, standby: 0, total: 1 },
    weights: {
      planned_pax_lbs: "180.0",
      planned_bags_lbs: "20.0",
      actual_pax_lbs: "0",
      actual_bags_lbs: "0",
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true });
});

/** The phone's list (#119): every row, as a phone shows it. */
const phoneList = () => within(screen.getAllByRole("list")[0]);

function offline(isOffline: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => !isOffline });
}

describe("CheckInBoard (#103)", () => {
  it("shows the counts and planned against actual weight", () => {
    render(<CheckInBoard initial={view()} canAct />);
    const counts = screen.getByRole("group", { name: "Check-in counts" });
    expect(within(counts).getByText("Booked")).toBeInTheDocument();
    const weights = screen.getByRole("group", { name: "Weights" });
    expect(within(weights).getByText("200 lb")).toBeInTheDocument();
  });

  it("checks a passenger in with what the company requires, asking the hazmat question", async () => {
    const after = view({
      passengers: [pax({ check_in_status: "checked_in", checked_in_by_name: "Gabe Gate" })],
    });
    actions.checkInAction.mockResolvedValue({ ok: true, view: after });
    render(<CheckInBoard initial={view()} canAct />);
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Check in Ana Andrews" }));

    const dialog = await screen.findByRole("dialog");
    // Not answered for them: legacy pre-ticked "No hazmat".
    expect(within(dialog).getByRole("radio", { name: "No hazmat" })).not.toBeChecked();
    fireEvent.change(within(dialog).getByLabelText(/^Bags/), { target: { value: "2" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Government ID verified/ }));
    fireEvent.click(within(dialog).getByRole("radio", { name: "No hazmat" }));
    fireEvent.change(within(dialog).getByLabelText(/Home village/), { target: { value: "Emmonak" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check In Passenger" }));

    await waitFor(() => expect(actions.checkInAction).toHaveBeenCalled());
    const [flightId, paxId, input] = actions.checkInAction.mock.calls[0];
    expect([flightId, paxId]).toEqual(["f-1", "p-ana"]);
    expect(input).toMatchObject({
      bags_count: 2,
      id_verified: true,
      hazmat_declared: false,
      actual_weight_lbs: 180,
      custom_fields: { village: "Emmonak" },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(screen.getByRole("table")).getByText("Checked in")).toBeInTheDocument();
  });

  it("keeps the dialog open with the server's refusal", async () => {
    actions.checkInAction.mockResolvedValue({ ok: false, error: "Still needed: Bag count." });
    render(<CheckInBoard initial={view()} canAct />);
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Check in Ana Andrews" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Check In Passenger" }));
    expect(await within(dialog).findByText("Still needed: Bag count.")).toBeInTheDocument();
  });

  it("marks a no-show with a reason, saying about the fee and the bags", async () => {
    actions.noShowAction.mockResolvedValue({ ok: true, view: view() });
    render(<CheckInBoard initial={view()} canAct />);
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "No-show Ana Andrews" }));
    const dialog = await screen.findByRole("dialog");
    // Standby, no seat is recorded when boarding closes, not chosen here.
    expect(within(dialog).queryByRole("option", { name: "Standby, no seat" })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/no-show fee of \$75\.00/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Make sure the ramp takes them off/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm No-show" }));
    await waitFor(() =>
      // A step taken with signal is the server's now: no time of its own (#119).
      expect(actions.noShowAction).toHaveBeenCalledWith("f-1", "p-ana", "did_not_appear", null, undefined),
    );
  });

  it("offers Promote for standby and Board once boarding is open", () => {
    render(
      <CheckInBoard
        initial={view({
          boarding_opened_at: "2026-10-22T18:00:00Z",
          passengers: [
            pax({ id: "p-sam", first_name: "Sam", last_name: "Standby", ticket_type: "standby", standby: true }),
            pax({ id: "p-ana", check_in_status: "checked_in" }),
          ],
        })}
        canAct
      />,
    );
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Promote Sam Standby" })).toBeInTheDocument();
    expect(table.getByRole("button", { name: "Board Ana Andrews" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Boarding" })).toBeInTheDocument();
  });

  it("closes boarding after saying what happens to the manifest and the standby list", async () => {
    actions.closeBoardingAction.mockResolvedValue({
      ok: true,
      view: view({ boarding_closed_at: "2026-10-22T18:20:00Z", manifest_status: "final" }),
    });
    render(
      <CheckInBoard
        initial={view({
          boarding_opened_at: "2026-10-22T18:00:00Z",
          passengers: [pax({ ticket_type: "standby", standby: true })],
        })}
        canAct
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close Boarding" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/The manifest locks/)).toBeInTheDocument();
    expect(within(dialog).getByText(/1 standby passenger still waiting/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close Boarding" }));
    await waitFor(() => expect(actions.closeBoardingAction).toHaveBeenCalledWith("f-1"));
    expect(await screen.findByText(/the manifest is final/)).toBeInTheDocument();
  });

  it("is read-only below the check-in roles, and once the manifest is locked", () => {
    const { rerender } = render(<CheckInBoard initial={view()} canAct={false} />);
    expect(screen.queryByRole("button", { name: "Check in Ana Andrews" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Begin Boarding" })).not.toBeInTheDocument();
    rerender(<CheckInBoard initial={view({ manifest_status: "final" })} canAct key="locked" />);
    expect(screen.queryByRole("button", { name: "Check in Ana Andrews" })).not.toBeInTheDocument();
    expect(screen.getByText("Manifest locked")).toBeInTheDocument();
  });

  it("points to the manifest when the flight has none", () => {
    render(<CheckInBoard initial={view({ manifest_id: null, manifest_status: null, passengers: [] })} canAct />);
    expect(screen.getByText("No manifest yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the manifest/ })).toHaveAttribute("href", "/manifest/f-1");
  });
});

describe("on a phone, and without signal (#119)", () => {
  const NOTHING_REQUIRED = {
    require_actual_weight: false,
    require_actual_bag_weight: false,
    require_bags_count: false,
    require_id_verification: false,
    require_hazmat_declaration: false,
    require_seat_assignment: false,
    no_show_fee: null,
    standby_enabled: true,
    allow_walk_up: true,
    lock_manifest_on_close: true,
  };

  it("checks in with one tap when the company requires nothing more", async () => {
    const after = view({ rules: NOTHING_REQUIRED, fields: [], passengers: [pax({ check_in_status: "checked_in" })] });
    actions.checkInAction.mockResolvedValue({ ok: true, view: after });
    render(<CheckInBoard initial={view({ rules: NOTHING_REQUIRED, fields: [] })} canAct />);
    fireEvent.click(phoneList().getByRole("button", { name: "Check in Ana Andrews" }));
    await waitFor(() => expect(actions.checkInAction).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(actions.checkInAction.mock.calls[0].slice(0, 2)).toEqual(["f-1", "p-ana"]);
  });

  it("boards with the box beside the name once boarding is open", async () => {
    const checkedIn = view({ boarding_opened_at: "2026-10-22T18:00:00Z", passengers: [pax({ check_in_status: "checked_in" })] });
    const boarded = view({ ...checkedIn, passengers: [pax({ check_in_status: "boarded" })] });
    actions.boardAction.mockResolvedValue({ ok: true, view: boarded });
    render(<CheckInBoard initial={checkedIn} canAct />);
    const box = phoneList().getByRole("checkbox", { name: "Board Ana Andrews" });
    expect(box).toHaveAttribute("aria-checked", "false");
    fireEvent.click(box);
    await waitFor(() =>
      expect(phoneList().getByRole("checkbox", { name: "Ana Andrews on board" })).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("keeps a tap without signal, shows it, and sends it with its time once back", async () => {
    const checkedIn = view({ boarding_opened_at: "2026-10-22T18:00:00Z", passengers: [pax({ check_in_status: "checked_in" })] });
    const boarded = view({ ...checkedIn, passengers: [pax({ check_in_status: "boarded" })] });
    actions.boardAction.mockResolvedValue({ ok: true, view: boarded });
    offline(true);
    render(<CheckInBoard initial={checkedIn} canAct />);
    fireEvent.click(phoneList().getByRole("checkbox", { name: "Board Ana Andrews" }));

    expect(actions.boardAction).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("1 step is waiting for signal");
    expect(phoneList().getByText("Waiting for signal")).toBeInTheDocument();
    expect(phoneList().getByRole("checkbox", { name: "Ana Andrews on board" })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("fo-check-in-queue:f-1")!)).toHaveLength(1);

    offline(false);
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(actions.boardAction).toHaveBeenCalled());
    const [flightId, paxId, at] = actions.boardAction.mock.calls[0];
    expect([flightId, paxId]).toEqual(["f-1", "p-ana"]);
    expect(Number.isNaN(Date.parse(at))).toBe(false);
    await waitFor(() => expect(screen.queryByText(/waiting for signal/)).not.toBeInTheDocument());
    expect(window.localStorage.getItem("fo-check-in-queue:f-1")).toBeNull();
  });

  it("keeps a tap when the send fails for want of signal, and says what was refused later", async () => {
    const checkedIn = view({ boarding_opened_at: "2026-10-22T18:00:00Z", passengers: [pax({ check_in_status: "checked_in" })] });
    actions.boardAction.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<CheckInBoard initial={checkedIn} canAct />);
    fireEvent.click(phoneList().getByRole("checkbox", { name: "Board Ana Andrews" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 step is waiting"));

    actions.boardAction.mockResolvedValueOnce({ ok: false, error: "Boarding is closed." });
    actions.refreshAction.mockResolvedValueOnce({ ok: true, view: checkedIn });
    fireEvent.click(screen.getByRole("button", { name: "Send now ›" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ana Andrews: Boarding is closed."));
    expect(actions.refreshAction).toHaveBeenCalledWith("f-1");
  });

  it("keeps a tap the server couldn't take yet, rather than dropping it", async () => {
    const checkedIn = view({ boarding_opened_at: "2026-10-22T18:00:00Z", passengers: [pax({ check_in_status: "checked_in" })] });
    offline(true);
    render(<CheckInBoard initial={checkedIn} canAct />);
    fireEvent.click(phoneList().getByRole("checkbox", { name: "Board Ana Andrews" }));
    offline(false);
    actions.boardAction.mockResolvedValueOnce({ ok: false, error: "Your session expired — please sign in again.", retry: true });
    fireEvent.click(screen.getByRole("button", { name: "Send now ›" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Your session expired"));
    expect(screen.getByRole("status")).toHaveTextContent("1 step is waiting");
    expect(JSON.parse(window.localStorage.getItem("fo-check-in-queue:f-1")!)).toHaveLength(1);
  });

  it("keeps a tap made while the one before it is on its way", async () => {
    const checkedIn = view({ passengers: [pax({ check_in_status: "checked_in" })] });
    let finishOpening: (r: unknown) => void = () => {};
    actions.openBoardingAction.mockReturnValueOnce(new Promise((resolve) => (finishOpening = resolve)));
    const opened = view({ ...checkedIn, boarding_opened_at: "2026-10-22T18:00:00Z" });
    actions.boardAction.mockResolvedValue({ ok: true, view: { ...opened, passengers: [pax({ check_in_status: "boarded" })] } });
    render(<CheckInBoard initial={checkedIn} canAct />);
    fireEvent.click(screen.getByRole("button", { name: "Begin Boarding" }));
    // Boarding shows open at once; the board tap goes behind it.
    fireEvent.click(phoneList().getByRole("checkbox", { name: "Board Ana Andrews" }));
    expect(actions.boardAction).not.toHaveBeenCalled();
    finishOpening({ ok: true, view: opened });
    await waitFor(() => expect(actions.boardAction).toHaveBeenCalled());
    await waitFor(() => expect(window.localStorage.getItem("fo-check-in-queue:f-1")).toBeNull());
  });

  it("picks up what an earlier visit kept", async () => {
    window.localStorage.setItem(
      "fo-check-in-queue:f-1",
      JSON.stringify([{ kind: "no-show", paxId: "p-ana", reason: "did_not_appear", notes: null, at: "2026-10-22T18:01:00Z" }]),
    );
    offline(true);
    render(<CheckInBoard initial={view()} canAct />);
    await waitFor(() => expect(within(screen.getByRole("table")).getByText("No-show")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("1 step is waiting");
  });
});

