import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MxClock } from "@/lib/api/maintenance";

const { startClockAction, stampMilestoneAction, moveOnClockAction } = vi.hoisted(() => ({
  startClockAction: vi.fn(),
  stampMilestoneAction: vi.fn(),
  moveOnClockAction: vi.fn(),
}));
vi.mock("./actions", () => ({ startClockAction, stampMilestoneAction, moveOnClockAction }));

import { BeginWorkForm } from "./begin-work-form";
import { ClockCard } from "./clock-card";

const clock = (over: Partial<MxClock> = {}): MxClock => ({
  id: "c-1",
  aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208", airframe_type: "caravan" },
  work_order_id: "wo-1",
  wo_number: "WO-7",
  status: "active",
  started_at: "2026-11-05T18:00:00Z",
  completed_at: null,
  total_hours: null,
  elapsed_hours: 2.25,
  started_by: "Mo Mechanic",
  notes: "100 hour",
  milestones: [
    { key: "aircraft_pulled", label: "Aircraft Pulled", at: "2026-11-05T18:05:00Z" },
    { key: "inspection_started", label: "Inspection Started", at: null },
  ],
  mechanics: [{ user_id: "u-1", name: "Mo Mechanic", clocked_in: "2026-11-05T18:00:00Z" }],
  on_clock: true,
  ...over,
});

beforeEach(() => {
  for (const fn of [startClockAction, stampMilestoneAction, moveOnClockAction]) {
    fn.mockReset();
    fn.mockResolvedValue({ ok: true });
  }
});
afterEach(() => vi.restoreAllMocks());

function card(over: Partial<MxClock> = {}, canRun = true) {
  render(<ClockCard clock={clock(over)} canRun={canRun} started="Nov 5, 09:00" stamps={{ aircraft_pulled: "Nov 5, 09:05" }} />);
}

describe("a running clock (#172)", () => {
  it("shows its hours, who started it, and its work order", () => {
    card();
    const article = screen.getByRole("article", { name: "Clock on N207GE" });
    expect(within(article).getByText("2.3h")).toBeInTheDocument();
    expect(article).toHaveTextContent("Started Nov 5, 09:00 by Mo Mechanic · 100 hour");
    expect(within(article).getByRole("link", { name: "WO-7" })).toHaveAttribute("href", "/maintenance/work-orders/wo-1");
  });

  it("stamps a milestone once, and shows when", async () => {
    const user = userEvent.setup();
    card();
    expect(screen.getByText("Nov 5, 09:05")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aircraft Pulled/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Inspection Started" }));
    expect(stampMilestoneAction).toHaveBeenCalledWith("c-1", "inspection_started");
  });

  it("offers Leave to someone on it and Join to someone who isn't", async () => {
    const user = userEvent.setup();
    card();
    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(moveOnClockAction).toHaveBeenCalledWith("c-1", "leave");
    document.body.innerHTML = "";
    card({ on_clock: false });
    await user.click(screen.getByRole("button", { name: "+ Join" }));
    expect(moveOnClockAction).toHaveBeenLastCalledWith("c-1", "join");
  });

  it("asks before completing", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    card();
    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect(moveOnClockAction).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect(moveOnClockAction).toHaveBeenCalledWith("c-1", "complete");
  });

  it("gives someone outside the shop nothing to press", () => {
    card({}, false);
    expect(screen.queryAllByRole("button")).toEqual([]);
    expect(screen.getByText("Inspection Started")).toBeInTheDocument();
  });

  it("says what the server refused", async () => {
    stampMilestoneAction.mockResolvedValue({ ok: false, message: "This clock has finished." });
    const user = userEvent.setup();
    card();
    await user.click(screen.getByRole("button", { name: "Inspection Started" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This clock has finished.");
  });
});

describe("Begin Maintenance (#172)", () => {
  const props = {
    aircraft: [
      { id: "ac-1", tail_number: "N207GE", model: "C208" },
      { id: "ac-2", tail_number: "N208GE", model: null },
    ],
    workOrders: [
      { id: "wo-1", wo_number: "WO-1", aircraft_id: "ac-1", title: "Oil change" },
      { id: "wo-2", wo_number: "WO-2", aircraft_id: "ac-2", title: "Annual" },
    ],
  };

  it("offers the aircraft's own work orders, and clears them on a change", async () => {
    const user = userEvent.setup();
    render(<BeginWorkForm {...props} />);
    const orders = () => Array.from(screen.getByLabelText(/Work Order/).querySelectorAll("option")).map((o) => o.value);
    expect(screen.getByLabelText(/Work Order/)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Aircraft"), "ac-1");
    expect(orders()).toEqual(["", "wo-1"]);
    await user.selectOptions(screen.getByLabelText(/Work Order/), "wo-1");
    await user.selectOptions(screen.getByLabelText("Aircraft"), "ac-2");
    expect(orders()).toEqual(["", "wo-2"]);
    expect(screen.getByLabelText(/Work Order/)).toHaveValue("");
  });

  it("starts the clock, and empties the form", async () => {
    const user = userEvent.setup();
    render(<BeginWorkForm {...props} />);
    await user.selectOptions(screen.getByLabelText("Aircraft"), "ac-1");
    await user.selectOptions(screen.getByLabelText(/Work Order/), "wo-1");
    await user.type(screen.getByLabelText("Notes"), "100 hour");
    await user.click(screen.getByRole("button", { name: "Begin Work" }));
    expect(startClockAction).toHaveBeenCalledWith({ aircraftId: "ac-1", workOrderId: "wo-1", notes: "100 hour" });
    expect(screen.getByLabelText("Aircraft")).toHaveValue("");
    expect(screen.getByLabelText("Notes")).toHaveValue("");
  });

  it("says when a clock is already running", async () => {
    startClockAction.mockResolvedValue({ ok: false, message: "A clock is already running on this aircraft: join it." });
    const user = userEvent.setup();
    render(<BeginWorkForm {...props} />);
    await user.selectOptions(screen.getByLabelText("Aircraft"), "ac-1");
    await user.click(screen.getByRole("button", { name: "Begin Work" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("join it");
    expect(screen.getByLabelText("Aircraft")).toHaveValue("ac-1");
  });
});
