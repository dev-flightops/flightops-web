import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CrewCalendar, ScheduleTag } from "@/lib/api/crew-calendar";

const actions = vi.hoisted(() => ({
  saveAssignmentAction: vi.fn(),
  deleteAssignmentAction: vi.fn(),
  moveHomeBaseAction: vi.fn(),
  createTagAction: vi.fn(),
  updateTagAction: vi.fn(),
  paintDaysAction: vi.fn(),
}));

vi.mock("./actions", () => actions);
// The constants module imports the API client; keep its session code out.
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));

import { CrewCalendarGrid } from "./crew-calendar-grid";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

const FLY: ScheduleTag = { id: "t-fly", label: "FLY", tone: "blue", sort_order: 10, is_active: true };
const OFF: ScheduleTag = { id: "t-off", label: "OFF", tone: "gray", sort_order: 20, is_active: true };
const OLD: ScheduleTag = {
  id: "t-old",
  label: "STANDBY",
  tone: "yellow",
  sort_order: 30,
  is_active: false,
};

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
  airframe_types: ["caravan"],
  aircraft: [],
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
  entries: [],
  tags: [FLY, OFF, OLD],
  cells: [
    { user_id: ALICE, cell_date: "2026-10-05", tag_id: "t-fly" },
    // An archived tag's day keeps it.
    { user_id: ALICE, cell_date: "2026-10-06", tag_id: "t-old" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(actions)) fn.mockResolvedValue({ ok: true });
});

const cellOf = (name: RegExp) => screen.getByRole("button", { name }).closest("td")!;

describe("day tags for a reader", () => {
  it("shows the painted days and a legend, with no palette", () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit={false} />);
    const legend = screen.getByRole("list", { name: "Day tags" });
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "FLY",
      "OFF",
    ]);
    expect(screen.getByTitle("FLY")).toHaveTextContent("FLY");
    expect(screen.getByTitle("STANDBY")).toHaveTextContent("STAN");
    expect(screen.queryByRole("button", { name: "Eraser" })).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Tag" })).toBeNull();
  });
});

describe("painting days", () => {
  it("offers nothing to paint until a tag is picked, and never an archived one", () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    expect(screen.queryByRole("button", { name: /^Paint / })).toBeNull();
    expect(screen.getByText(/Pick a tag, then click a day/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "STANDBY" })).toBeNull();
  });

  it("paints a dragged run with the picked tag, either way round", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "OFF" }));
    expect(screen.getByRole("button", { name: "OFF" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.mouseDown(cellOf(/Paint OFF on Bob Pilot's .*Oct 14/), { button: 0 });
    fireEvent.mouseEnter(cellOf(/Paint OFF on Bob Pilot's .*Oct 12/));
    fireEvent.mouseUp(window);

    await vi.waitFor(() =>
      expect(actions.paintDaysAction).toHaveBeenCalledWith(BOB, "2026-10-12", "2026-10-14", "t-off"),
    );
    // Shown straight away, before the calendar refreshes.
    expect(screen.getByRole("button", { name: /Paint OFF on Bob Pilot's .*Oct 13/ })).toHaveTextContent(
      "OFF",
    );
  });

  it("clears a day with the eraser", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "Eraser" }));
    fireEvent.mouseDown(cellOf(/Clear Alice Pilot's .*Oct 5 \(FLY\)/), { button: 0 });
    fireEvent.mouseUp(window);
    await vi.waitFor(() =>
      expect(actions.paintDaysAction).toHaveBeenCalledWith(ALICE, "2026-10-05", "2026-10-05", null),
    );
  });

  it("clears a tagged day on right-click, with no tool picked", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.contextMenu(screen.getByTitle("FLY").closest("td")!);
    await vi.waitFor(() =>
      expect(actions.paintDaysAction).toHaveBeenCalledWith(ALICE, "2026-10-05", "2026-10-05", null),
    );
  });

  it("paints one day from the keyboard", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "FLY" }));
    fireEvent.keyDown(screen.getByRole("button", { name: /Paint FLY on Alice Pilot's .*Oct 20/ }), {
      key: "Enter",
    });
    await vi.waitFor(() =>
      expect(actions.paintDaysAction).toHaveBeenCalledWith(ALICE, "2026-10-20", "2026-10-20", "t-fly"),
    );
  });

  it("undoes a refused paint and says why", async () => {
    actions.paintDaysAction.mockResolvedValueOnce({
      ok: false,
      error: "Only a Chief Pilot, Director of Operations or Exec Admin can change the crew calendar.",
    });
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "FLY" }));
    const day = /Paint FLY on Bob Pilot's .*Oct 22/;
    fireEvent.mouseDown(cellOf(day), { button: 0 });
    fireEvent.mouseUp(window);
    expect(await screen.findByRole("alert")).toHaveTextContent("Only a Chief Pilot");
    expect(screen.getByRole("button", { name: day })).toHaveTextContent("");
  });
});

describe("tag dialogs", () => {
  it("adds a tag with its colour", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "+ Tag" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^Label/), { target: { value: "TRN" } });
    fireEvent.click(within(dialog).getByLabelText("purple"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Tag" }));
    await vi.waitFor(() => expect(actions.createTagAction).toHaveBeenCalledWith("TRN", "purple"));
  });

  it("renames, archives and restores from Manage", async () => {
    render(<CrewCalendarGrid calendar={CALENDAR} canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    const dialog = await screen.findByRole("dialog");
    const rows = within(dialog).getAllByRole("listitem");
    expect(rows).toHaveLength(3);

    fireEvent.change(within(rows[1]).getByLabelText("Label for OFF"), { target: { value: "LEAVE" } });
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Save" }));
    await vi.waitFor(() =>
      expect(actions.updateTagAction).toHaveBeenCalledWith("t-off", { label: "LEAVE", tone: "gray" }),
    );

    fireEvent.click(within(rows[0]).getByRole("button", { name: "Archive" }));
    await vi.waitFor(() =>
      expect(actions.updateTagAction).toHaveBeenCalledWith("t-fly", { is_active: false }),
    );

    expect(within(rows[2]).getByText("Archived")).toBeInTheDocument();
    fireEvent.click(within(rows[2]).getByRole("button", { name: "Restore" }));
    await vi.waitFor(() =>
      expect(actions.updateTagAction).toHaveBeenCalledWith("t-old", { is_active: true }),
    );
  });
});
