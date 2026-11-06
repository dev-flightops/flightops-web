import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { tracePart, loadZoneTable } = vi.hoisted(() => ({ tracePart: vi.fn(), loadZoneTable: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/maintenance", () => ({ tracePart }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));

import BatchTracePage from "./page";

async function show(params: Record<string, string> = {}) {
  render(await BatchTracePage({ searchParams: Promise.resolve(params) }));
}

const issued = {
  id: "t-1",
  txn_type: "issued",
  quantity: -2,
  aircraft_id: "ac-1",
  aircraft_tail: "N207GE",
  work_order_id: "wo-1",
  wo_number: "WO-7",
  reference: "PO 12",
  batch_number: "B-7",
  lot_number: "L9",
  notes: null,
  recorded_by: "Mo Mechanic",
  recorded_at: "2026-11-05T20:00:00Z",
  part_id: "p-1",
  part_number: "CH48110-1",
  part_description: "Oil filter",
};

beforeEach(() => {
  tracePart.mockReset();
  loadZoneTable.mockResolvedValue({ fallback: "America/Anchorage" });
});

describe("Batch & Lot Traceability (#172)", () => {
  it("asks for a batch or lot first, and suggests the batches on file", async () => {
    tracePart.mockResolvedValue({ results: [], affected_aircraft: [], batches: ["B-7"] });
    await show();
    expect(screen.getByText(/Enter a batch or lot number above/)).toBeInTheDocument();
    expect(document.querySelector("#trace-batches option")).toHaveAttribute("value", "B-7");
    expect(screen.queryByRole("link", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("lists each movement, and the person who recorded it", async () => {
    tracePart.mockResolvedValue({
      results: [issued],
      affected_aircraft: [{ id: "ac-1", tail_number: "N207GE", model: "C208" }],
      batches: ["B-7"],
    });
    await show({ batch: "B-7" });
    expect(tracePart).toHaveBeenCalledWith({ batch: "B-7", lot: "" });
    expect(screen.getByRole("status")).toHaveTextContent('Found 1 transaction matching batch "B-7".');
    const row = screen.getByRole("row", { name: /CH48110-1/ });
    expect(within(row).getByText("Issued")).toBeInTheDocument();
    expect(within(row).getByText("-2")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "WO-7" })).toHaveAttribute("href", "/maintenance/work-orders/wo-1");
    // Legacy printed the reference here.
    expect(within(row).getByText("Mo Mechanic")).toBeInTheDocument();
    expect(within(row).queryByText("PO 12")).not.toBeInTheDocument();
    const affected = screen.getByRole("region", { name: "Affected aircraft" });
    expect(within(affected).getByRole("link", { name: /N207GE/ })).toHaveAttribute("href", "/maintenance/aircraft/ac-1");
    expect(screen.getByRole("link", { name: "Clear" })).toBeInTheDocument();
  });

  it("names both when both are given, and says when nothing matches", async () => {
    tracePart.mockResolvedValue({ results: [], affected_aircraft: [], batches: [] });
    await show({ batch: "B", lot: "L" });
    expect(tracePart).toHaveBeenCalledWith({ batch: "B", lot: "L" });
    expect(screen.getByText("No transactions found for this batch or lot number.")).toBeInTheDocument();
  });

  it("shows no summary when nothing went on an aircraft", async () => {
    tracePart.mockResolvedValue({
      results: [{ ...issued, aircraft_id: null, aircraft_tail: null }],
      affected_aircraft: [],
      batches: [],
    });
    await show({ lot: "L9" });
    expect(screen.getByRole("status")).toHaveTextContent('matching lot "L9"');
    expect(screen.queryByRole("region", { name: "Affected aircraft" })).not.toBeInTheDocument();
  });
});
