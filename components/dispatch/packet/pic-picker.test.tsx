import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(""),
}));

const { assignCrewAction, unassignCrewAction } = vi.hoisted(() => ({
  assignCrewAction: vi.fn(),
  unassignCrewAction: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/crew-actions", () => ({
  assignCrewAction,
  unassignCrewAction,
}));

import { PicPicker, type PicOption } from "./pic-picker";

const sarah: PicOption = {
  pilot: {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    full_name: "Sarah Kessler",
    email: "sarah@x",
  },
  status: "early_month",
};
const bob: PicOption = {
  pilot: {
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    full_name: "Bob Henderson",
    email: "bob@x",
  },
  status: "grace_month",
};
const alice: PicOption = {
  pilot: {
    id: "aaaaaaaa-0000-0000-0000-000000000003",
    full_name: "Alice Chen",
    email: "alice@x",
  },
  status: "non_current",
};

describe("PicPicker (M2-G-5)", () => {
  it("renders one option per pilot with the status label appended", () => {
    render(
      <PicPicker options={[sarah, bob, alice]} currentPicId={null} />,
    );
    const combo = screen.getByLabelText("Pilot in Command") as HTMLSelectElement;
    expect(combo).toBeInTheDocument();
    // 3 pilots + the "select a pilot" placeholder
    expect(combo.options).toHaveLength(4);
    // Status shows in the option text.
    expect(combo.textContent).toMatch(/Sarah Kessler.*Fully current/);
    expect(combo.textContent).toMatch(/Bob Henderson.*Grace month/);
    expect(combo.textContent).toMatch(/Alice Chen.*NON-CURRENT/);
  });

  it("renders the red status dot next to the label when the selected PIC is non-current", () => {
    render(
      <PicPicker
        options={[sarah, bob, alice]}
        currentPicId={alice.pilot.id}
      />,
    );
    const dot = screen.getByLabelText(/PIC compliance red/i);
    expect(dot).toBeInTheDocument();
  });

  it("navigates to /dispatch/?pic=<uuid> when a pilot is chosen", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(
      <PicPicker options={[sarah, bob, alice]} currentPicId={null} />,
    );
    await user.selectOptions(
      screen.getByLabelText("Pilot in Command"),
      alice.pilot.id,
    );
    expect(push).toHaveBeenCalledWith(`/dispatch/?pic=${alice.pilot.id}`);
  });

  it("clears the pic param when the placeholder option is chosen", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(
      <PicPicker
        options={[sarah, bob, alice]}
        currentPicId={alice.pilot.id}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText("Pilot in Command"),
      "",
    );
    expect(push).toHaveBeenCalledWith("/dispatch/");
  });

  it("disables and shows an empty-roster label when no pilots exist", () => {
    render(<PicPicker options={[]} currentPicId={null} />);
    const combo = screen.getByLabelText(
      "Pilot in Command",
    ) as HTMLSelectElement;
    expect(combo).toBeDisabled();
    expect(combo.textContent).toMatch(/No pilots on roster/);
  });
});


// ---------------------------------------------------------------------------
// Persistence (flightops-services#171)
// ---------------------------------------------------------------------------

describe("PicPicker — persisting the choice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assignCrewAction.mockResolvedValue({ ok: true });
    unassignCrewAction.mockResolvedValue({ ok: true });
  });

  it("assigns the pilot as PIC when a flight is loaded", async () => {
    // Before flight_crew_assignments this only pushed ?pic= and the
    // choice left with the URL — the pilot's own page never knew.
    render(
      <PicPicker
        options={[sarah, bob, alice]}
        currentPicId={null}
        flightId="f-1"
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Pilot in Command"),
      sarah.pilot.id,
    );
    expect(assignCrewAction).toHaveBeenCalledWith("f-1", sarah.pilot.id, "pic");
  });

  it("stands the pilot down when the selection is cleared", async () => {
    render(
      <PicPicker
        options={[sarah, bob, alice]}
        currentPicId={sarah.pilot.id}
        flightId="f-1"
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Pilot in Command"), "");
    expect(unassignCrewAction).toHaveBeenCalledWith("f-1", sarah.pilot.id);
  });

  it("stays a pre-screen when no flight is loaded", async () => {
    // A hand-filled packet has nothing to assign crew to. The picker
    // still drives the compliance gate so the dispatcher can check a
    // pilot's currency before committing to anything.
    render(<PicPicker options={[sarah, bob, alice]} currentPicId={null} />);
    await userEvent.selectOptions(
      screen.getByLabelText("Pilot in Command"),
      sarah.pilot.id,
    );
    expect(assignCrewAction).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalled();
  });

  it("does not move the URL when the assignment is refused", async () => {
    // If the write failed, ?pic= must not advance — the compliance gate
    // downstream reads it, and would start describing a pilot who is
    // not on the flight.
    assignCrewAction.mockResolvedValue({
      ok: false,
      error: "Ann Pilot is already PIC on PGR900. Remove them first.",
    });
    render(
      <PicPicker
        options={[sarah, bob, alice]}
        currentPicId={null}
        flightId="f-1"
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Pilot in Command"),
      bob.pilot.id,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already PIC on PGR900/,
    );
    expect(push).not.toHaveBeenCalled();
  });
});
