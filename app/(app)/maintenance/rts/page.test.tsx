import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RtsQueue, RtsSquawk } from "@/lib/api/maintenance";

const { getRtsQueue, loadZoneTable, auth } = vi.hoisted(() => ({
  getRtsQueue: vi.fn(),
  loadZoneTable: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/maintenance", () => ({ getRtsQueue }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("./rts-forms", () => ({
  SignOffForm: ({ name, rii }: { name: string; rii?: boolean }) => <div data-testid="sign-off">{`${name}|${String(rii)}`}</div>,
  InspectForm: () => <div data-testid="inspect" />,
  RejectForm: () => <div data-testid="reject" />,
  DeferForm: () => <div data-testid="defer" />,
}));

import RtsQueuePage from "./page";

const aircraft = { id: "ac-1", tail_number: "N207GE", model: "C208", airframe_type: "caravan", base: "PABE" };

const squawk = (over: Partial<RtsSquawk> = {}): RtsSquawk => ({
  id: "s-1",
  aircraft,
  reported_at: "2026-11-05T18:00:00Z",
  reported_by: "Pat Pilot",
  title: "Generator inop",
  description: "Failed on shutdown.",
  severity: "grounding",
  status: "open",
  is_rii: false,
  work_order: null,
  rts_submitted_at: null,
  signed_by_me: false,
  rts_work_notes: null,
  rts_amt_name: null,
  rts_amt_cert_number: null,
  rts_amt_cert_type: null,
  rts_rejection_notes: null,
  ...over,
});

const empty: RtsQueue = { pending_rii: [], pending_rts: [], open_on_hold: [], held_aircraft: [] };

async function show() {
  render(await RtsQueuePage());
}

beforeEach(() => {
  auth.mockResolvedValue({ roles: ["maintenance"], user: { name: " Mo Mechanic " } });
  loadZoneTable.mockResolvedValue({ fallback: "America/Anchorage" });
  getRtsQueue.mockReset();
});

describe("Return to Service Queue (#172)", () => {
  it("says when all is clear", async () => {
    getRtsQueue.mockResolvedValue(empty);
    await show();
    expect(screen.getByText("No pending RTS items")).toBeInTheDocument();
  });

  it("shows an RII with the AMT's sign-off and the inspector's form", async () => {
    getRtsQueue.mockResolvedValue({
      ...empty,
      pending_rii: [
        squawk({
          status: "in_progress",
          is_rii: true,
          rts_submitted_at: "2026-11-05T20:00:00Z",
          rts_amt_name: "Mo Mechanic",
          rts_amt_cert_number: "1234567",
          rts_amt_cert_type: "ap",
          rts_work_notes: "Replaced the generator.",
          work_order: { id: "wo-1", wo_number: "WO-7", status: "completed" },
        }),
      ],
    });
    await show();
    const section = screen.getByRole("region", { name: "RII awaiting inspector" });
    expect(section).toHaveTextContent("RII: Awaiting Inspector Signoff (1)");
    expect(section).toHaveTextContent("Primary AMT Signoff (Complete)");
    expect(section).toHaveTextContent("1234567");
    expect(section).toHaveTextContent("A&P");
    expect(section).toHaveTextContent("Replaced the generator.");
    expect(within(section).getByRole("link", { name: "WO-7" })).toHaveAttribute("href", "/maintenance/work-orders/wo-1");
    expect(within(section).getByTestId("inspect")).toBeInTheDocument();
    expect(within(section).getByTestId("reject")).toBeInTheDocument();
    expect(within(section).getByTestId("defer")).toBeInTheDocument();
  });

  it("won't offer the inspection to the person who signed", async () => {
    getRtsQueue.mockResolvedValue({
      ...empty,
      pending_rii: [squawk({ is_rii: true, rts_submitted_at: "2026-11-05T20:00:00Z", signed_by_me: true })],
    });
    await show();
    expect(screen.queryByTestId("inspect")).not.toBeInTheDocument();
    expect(screen.getByText(/You signed this work off/)).toBeInTheDocument();
    expect(screen.getByTestId("reject")).toBeInTheDocument();
  });

  it("offers a sign-off where the work order is finished, with no reject", async () => {
    getRtsQueue.mockResolvedValue({
      ...empty,
      pending_rts: [squawk({ severity: "major", is_rii: true, work_order: { id: "wo-1", wo_number: "WO-7", status: "completed" } })],
    });
    await show();
    const section = screen.getByRole("region", { name: "Pending return to service" });
    expect(section).toHaveTextContent("RII Required");
    expect(within(section).getByTestId("sign-off")).toHaveTextContent("Mo Mechanic|true");
    expect(within(section).getByTestId("defer")).toBeInTheDocument();
    expect(within(section).queryByTestId("reject")).not.toBeInTheDocument();
  });

  it("shows a grounding squawk with the work to do, and its rejection", async () => {
    getRtsQueue.mockResolvedValue({
      ...empty,
      open_on_hold: [squawk({ rts_rejection_notes: "Safety wire missing." })],
    });
    await show();
    const section = screen.getByRole("region", { name: "Open squawks on held aircraft" });
    expect(section).toHaveTextContent("Open: Work Required");
    expect(section).toHaveTextContent("Safety wire missing.");
    expect(within(section).getByRole("link", { name: /Open work order/ })).toHaveAttribute("href", "/maintenance/work-orders/new?squawk=s-1");
    expect(within(section).getByTestId("sign-off")).toBeInTheDocument();
  });

  it("lists each held aircraft with why", async () => {
    getRtsQueue.mockResolvedValue({
      ...empty,
      held_aircraft: [{ aircraft, reasons: ["Grounding squawk: Generator inop", "Annual overdue"] }],
    });
    await show();
    const section = screen.getByRole("region", { name: "Aircraft on hold" });
    expect(section).toHaveTextContent("Aircraft Currently on RTS Hold (1)");
    expect(section).toHaveTextContent("Grounding squawk: Generator inop");
    expect(section).toHaveTextContent("Annual overdue");
    expect(within(section).getByRole("link", { name: /View N207GE/ })).toHaveAttribute("href", "/maintenance/aircraft/ac-1");
    expect(screen.queryByText("No pending RTS items")).not.toBeInTheDocument();
  });

  it("is view only for anyone who can't sign", async () => {
    auth.mockResolvedValue({ roles: ["dispatcher"], user: { name: "Dana" } });
    getRtsQueue.mockResolvedValue({
      ...empty,
      pending_rii: [squawk({ is_rii: true, rts_submitted_at: "2026-11-05T20:00:00Z" })],
      pending_rts: [squawk({ id: "s-2", work_order: { id: "w", wo_number: "WO-1", status: "completed" } })],
      open_on_hold: [squawk({ id: "s-3" })],
    });
    await show();
    expect(screen.getByText(/View only/)).toBeInTheDocument();
    for (const form of ["sign-off", "inspect", "reject", "defer"]) {
      expect(screen.queryByTestId(form)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: /Open work order/ })).not.toBeInTheDocument();
    expect(screen.getByText(/RII inspection required before return to service/)).toBeInTheDocument();
  });

  it("lets the Chief Pilot open a work order, which is theirs, and not sign", async () => {
    auth.mockResolvedValue({ roles: ["chief_pilot"], user: { name: "Sarah" } });
    getRtsQueue.mockResolvedValue({ ...empty, open_on_hold: [squawk()] });
    await show();
    expect(screen.getByRole("link", { name: /Open work order/ })).toBeInTheDocument();
    expect(screen.queryByTestId("sign-off")).not.toBeInTheDocument();
  });

  it("says so when it can't load", async () => {
    getRtsQueue.mockRejectedValue(new Error("boom"));
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  });
});
