import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMxClocks, listWorkOrders, listAircraft, loadZoneTable, auth } = vi.hoisted(() => ({
  listMxClocks: vi.fn(),
  listWorkOrders: vi.fn(),
  listAircraft: vi.fn(),
  loadZoneTable: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/maintenance", () => ({ listMxClocks, listWorkOrders }));
vi.mock("@/lib/api/ops", () => ({ listAircraft }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("./begin-work-form", () => ({
  BeginWorkForm: ({ aircraft, workOrders }: { aircraft: { tail_number: string }[]; workOrders: { id: string }[] }) => (
    <div data-testid="begin-work">{`${aircraft.map((a) => a.tail_number).join(",")}|${workOrders.map((o) => o.id).join(",")}`}</div>
  ),
}));
vi.mock("./clock-card", () => ({
  ClockCard: ({ clock, canRun }: { clock: { id: string }; canRun: boolean }) => <div data-testid={`clock-${clock.id}`}>{String(canRun)}</div>,
}));

import MxClockPage from "./page";

const done = {
  id: "c-2",
  aircraft: { id: "ac-1", tail_number: "N207GE" },
  started_at: "2026-11-05T18:00:00Z",
  completed_at: "2026-11-05T20:30:00Z",
  total_hours: 2.5,
  started_by: "Mo Mechanic",
  milestones: [],
};

beforeEach(() => {
  auth.mockResolvedValue({ roles: ["maintenance"] });
  loadZoneTable.mockResolvedValue({ fallback: "America/Anchorage" });
  listAircraft.mockResolvedValue({
    items: [
      { id: "ac-1", tail_number: "N207GE", is_active: true },
      { id: "ac-9", tail_number: "N999", is_active: false },
    ],
  });
  listWorkOrders.mockImplementation(async ({ status }: { status: string }) => ({
    items: status === "open" ? [{ id: "wo-1", wo_number: "WO-1", aircraft_id: "ac-1", title: "Oil" }] : [],
  }));
  listMxClocks.mockReset();
  listAircraft.mockClear();
});

describe("Maintenance Clock (#172)", () => {
  it("offers the shop Begin Work with active aircraft and open work orders", async () => {
    listMxClocks.mockResolvedValue({ active: [{ id: "c-1", milestones: [] , started_at: "2026-11-05T18:00:00Z"}], recent: [] });
    render(await MxClockPage());
    expect(screen.getByTestId("begin-work")).toHaveTextContent("N207GE|wo-1");
    expect(screen.getByRole("region", { name: "Active clocks" })).toHaveTextContent("Active (1)");
    expect(screen.getByTestId("clock-c-1")).toHaveTextContent("true");
  });

  it("lists what's finished", async () => {
    listMxClocks.mockResolvedValue({ active: [], recent: [done] });
    render(await MxClockPage());
    const row = within(screen.getByRole("region", { name: "Recently completed" })).getByRole("row", { name: /N207GE/ });
    expect(within(row).getByText("2.5")).toBeInTheDocument();
    expect(within(row).getByText("Mo Mechanic")).toBeInTheDocument();
  });

  it("lets others look and not start anything", async () => {
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    listMxClocks.mockResolvedValue({ active: [{ id: "c-1", milestones: [], started_at: "2026-11-05T18:00:00Z" }], recent: [] });
    render(await MxClockPage());
    expect(screen.queryByTestId("begin-work")).not.toBeInTheDocument();
    expect(screen.getByTestId("clock-c-1")).toHaveTextContent("false");
    expect(listAircraft).not.toHaveBeenCalled();
  });

  it("says when there's nothing, in words for who's reading", async () => {
    listMxClocks.mockResolvedValue({ active: [], recent: [] });
    render(await MxClockPage());
    expect(screen.getByText(/Select an aircraft above/)).toBeInTheDocument();
    document.body.innerHTML = "";
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    render(await MxClockPage());
    expect(screen.getByText("No maintenance clocks.")).toBeInTheDocument();
  });

  it("links the report that reads it", async () => {
    listMxClocks.mockResolvedValue({ active: [], recent: [] });
    render(await MxClockPage());
    expect(screen.getByRole("link", { name: "Availability Report" })).toHaveAttribute("href", "/maintenance/availability");
  });
});
