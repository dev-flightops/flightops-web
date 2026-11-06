import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Part } from "@/lib/api/maintenance";

const { lookupPartAction, movePartAction, refresh } = vi.hoisted(() => ({
  lookupPartAction: vi.fn(),
  movePartAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./actions", () => ({ lookupPartAction, movePartAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { BarcodeScan } from "./barcode-scan";

const stock = (over: Partial<Part>): Part =>
  ({
    id: "p-1",
    part_number: "CH48110-1",
    description: "Oil filter",
    unit: "EA",
    qty_on_hand: 8,
    location: "PABE bin 4",
    batch_number: null,
    lot_number: null,
    expiration_date: null,
    expired: false,
    ...over,
  }) as Part;

async function open() {
  const user = userEvent.setup();
  render(<BarcodeScan />);
  await user.click(screen.getByRole("button", { name: "Barcode Scan" }));
  return user;
}

beforeEach(() => {
  lookupPartAction.mockReset();
  movePartAction.mockReset();
  refresh.mockReset();
});

describe("Barcode Scan (#172)", () => {
  it("looks a code up on Enter, as a scanner sends it", async () => {
    lookupPartAction.mockResolvedValue({ ok: true, parts: [stock({})] });
    const user = await open();
    await user.type(screen.getByLabelText("Barcode or part number"), "CH48110-1{Enter}");
    expect(lookupPartAction).toHaveBeenCalledWith("CH48110-1");
    expect(await screen.findByText(/Qty 8 EA · PABE bin 4/)).toBeInTheDocument();
  });

  it("shows each batch, so the one in hand is the one checked out", async () => {
    lookupPartAction.mockResolvedValue({
      ok: true,
      parts: [
        stock({ id: "soon", batch_number: "SOONER", expiration_date: "2026-12-01" }),
        stock({ id: "late", batch_number: "LATER", qty_on_hand: 3 }),
      ],
    });
    movePartAction.mockResolvedValue({ ok: true, qty: 2 });
    const user = await open();
    await user.type(screen.getByLabelText("Barcode or part number"), "CH48110-1{Enter}");
    expect(await screen.findByText(/Batch SOONER · Expires Dec 1, 2026/)).toBeInTheDocument();
    const checkOuts = screen.getAllByRole("button", { name: "Check Out (1)" });
    await user.click(checkOuts[1]);
    expect(movePartAction).toHaveBeenCalledWith({
      partId: "late",
      txn_type: "issued",
      quantity: "1",
      reference: "Barcode scan: check out",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Checked out 1 × CH48110-1. New qty: 2.");
    expect(refresh).toHaveBeenCalled();
  });

  it("checks in", async () => {
    lookupPartAction.mockResolvedValue({ ok: true, parts: [stock({})] });
    movePartAction.mockResolvedValue({ ok: true, qty: 9 });
    const user = await open();
    await user.type(screen.getByLabelText("Barcode or part number"), "X{Enter}");
    await user.click(await screen.findByRole("button", { name: "Check In (1)" }));
    expect(movePartAction.mock.calls[0][0].txn_type).toBe("received");
    expect(await screen.findByRole("status")).toHaveTextContent("Checked in");
  });

  it("says what the server refused, such as an expired part", async () => {
    lookupPartAction.mockResolvedValue({ ok: true, parts: [stock({ expired: true, expiration_date: "2026-01-01" })] });
    movePartAction.mockResolvedValue({ ok: false, message: "CH48110-1 expired on 2026-01-01: it can't be issued." });
    const user = await open();
    await user.type(screen.getByLabelText("Barcode or part number"), "X{Enter}");
    expect(await screen.findByText(/Expired Jan 1, 2026/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check Out (1)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("it can't be issued");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says when nothing has that code", async () => {
    lookupPartAction.mockResolvedValue({ ok: true, parts: [] });
    const user = await open();
    await user.type(screen.getByLabelText("Barcode or part number"), "NOPE{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Part NOPE not found.");
  });
});
