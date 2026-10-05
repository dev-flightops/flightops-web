import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CrewCalendar } from "@/lib/api/crew-calendar";

const { saveAssignmentAction, deleteAssignmentAction, moveHomeBaseAction } =
  vi.hoisted(() => ({
    saveAssignmentAction: vi.fn(),
    deleteAssignmentAction: vi.fn(),
    moveHomeBaseAction: vi.fn(),
  }));

vi.mock("./actions", () => ({
  saveAssignmentAction,
  deleteAssignmentAction,
  moveHomeBaseAction,
}));
// The constants module imports the API client; keep its session code out.
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));

import { CrewCalendarGrid } from "./crew-calendar-grid";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

const CALENDAR: CrewCalendar = {
  month: "2026-10",
  first_day: "2026-10-01",
  last_day: "2026-10-31",
  station: null,
  bases: ["PABE", "PANC"],
  stations: [
    { code: "PABE", name: "Bethel" },
    { code: "PANC", name: "Anchorage" },
  ],
  airframe_types: ["c207", "caravan"],
  aircraft: [
    { id: "a1", tail_number: "N208PA", airframe_type: "caravan" },
    { id: "a2", tail_number: "N207PA", airframe_type: "c207" },
  ],
  groups: [
    {
      station: "PABE",
      label: "PABE · Bethel",
      crew: [{ user_id: ALICE, full_name: "Alice Pilot", station: "PABE", roles: ["pilot"] }],
    },
    {
      station: "PANC",
      label: "PANC · Anchorage",
      crew: [{ user_id: BOB, full_name: "Bob Pilot", station: "PANC", roles: ["pilot"] }],
    },
  ],
  entries: [
    {
      id: "e1",
      user_id: ALICE,
      station: "PABE",
      airframe_type: "caravan",
      aircraft_id: "a1",
      tail_number: "N208PA",
      start_date: "2026-10-05",
      end_date: "2026-10-11",
      duty_type: "flying",
      notes: "Y-K run",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  saveAssignmentAction.mockResolvedValue({ ok: true });
  deleteAssignmentAction.mockResolvedValue({ ok: true });
  moveHomeBaseAction.mockResolvedValue({ ok: true });
});

describe("CrewCalendarGrid for a reader", () => {
  it("shows the month and the assignments, with nothing to edit", () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit={false} />);
    expect(screen.getByText("PABE · Bethel")).toBeInTheDocument();
    expect(screen.getByText("Flying · CARAVAN · N208PA · PABE")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add Assignment" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Move Alice Pilot/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add an assignment for/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Alice Pilot: Flying/ })).toBeNull();
  });

  it("has a column for each day of the month", () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit={false} />);
    const head = screen.getAllByRole("rowgroup")[0];
    // "Crew" plus 31 days.
    expect(within(head).getAllByRole("columnheader")).toHaveLength(32);
  });
});

describe("CrewCalendarGrid for a scheduler", () => {
  it("opens a new assignment on the pilot and day clicked", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(
      screen.getByRole("button", { name: /Add an assignment for Bob Pilot on .*Oct 20/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Add Assignment")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Pilot/)).toHaveValue(BOB);
    // A new assignment starts at the pilot's home base.
    expect(within(dialog).getByLabelText(/^Base/)).toHaveValue("PANC");
    expect(within(dialog).getByLabelText(/^From/)).toHaveValue("2026-10-20");
    expect(within(dialog).getByLabelText(/^To/)).toHaveValue("2026-10-20");
  });

  it("opens an assignment for editing and saves it with its id", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /Alice Pilot: Flying · CARAVAN/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Edit Assignment")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Aircraft type/)).toHaveValue("caravan");
    expect(within(dialog).getByLabelText(/^Tail/)).toHaveValue("a1");

    fireEvent.click(within(dialog).getByRole("button", { name: "Save Assignment" }));
    await vi.waitFor(() => expect(saveAssignmentAction).toHaveBeenCalledTimes(1));
    const sent = saveAssignmentAction.mock.calls[0][0] as FormData;
    expect(sent.get("entry_id")).toBe("e1");
    expect(sent.get("start_date")).toBe("2026-10-05");
    expect(sent.get("aircraft_id")).toBe("a1");
  });

  it("offers only tails of the chosen type", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Assignment" }));
    const dialog = await screen.findByRole("dialog");
    const tail = within(dialog).getByLabelText(/^Tail/);
    expect(tail).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/^Aircraft type/), {
      target: { value: "c207" },
    });
    expect(within(tail).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Any",
      "N207PA",
    ]);
  });

  it("shows the server's refusal and keeps the dialog open", async () => {
    saveAssignmentAction.mockResolvedValueOnce({
      ok: false,
      error: "Alice Pilot already has a flying assignment at PABE from 5 Oct 2026 to 11 Oct 2026.",
    });
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(
      screen.getByRole("button", { name: /Add an assignment for Alice Pilot on .*Oct 13/ }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Assignment" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "already has a flying assignment at PABE",
    );
  });

  it("removes an assignment after a second press", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /Alice Pilot: Flying · CARAVAN/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(deleteAssignmentAction).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Remove this assignment?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await vi.waitFor(() => expect(deleteAssignmentAction).toHaveBeenCalledWith("e1"));
  });

  it("moves a pilot to another base", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "Move Bob Pilot to another base" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Home base"), {
      target: { value: "PABE" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move" }));
    await vi.waitFor(() => expect(moveHomeBaseAction).toHaveBeenCalledWith(BOB, "PABE"));
  });
});
