import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { movePartAction } = vi.hoisted(() => ({ movePartAction: vi.fn() }));
vi.mock("../actions", () => ({ movePartAction }));

import { MoveStockForm } from "./move-stock-form";

const props = {
  partId: "p-1",
  unit: "EA",
  batch: "B1",
  lot: "L1",
  expired: false,
  aircraft: [
    { id: "ac-1", tail_number: "N207GE" },
    { id: "ac-2", tail_number: "N208GE" },
  ],
  workOrders: [
    { id: "wo-1", wo_number: "WO-1", aircraft_id: "ac-1", title: "Oil change" },
    { id: "wo-2", wo_number: "WO-2", aircraft_id: "ac-2", title: "Annual" },
  ],
};

beforeEach(() => {
  movePartAction.mockReset();
  movePartAction.mockResolvedValue({ ok: true, qty: 7 });
});

describe("Move stock (#172)", () => {
  it("issues to an aircraft, with the part's batch, which is what Batch Trace reads", async () => {
    const user = userEvent.setup();
    render(<MoveStockForm {...props} />);
    await user.selectOptions(screen.getByLabelText("Aircraft"), "ac-1");
    await user.clear(screen.getByLabelText(/Quantity/));
    await user.type(screen.getByLabelText(/Quantity/), "2");
    await user.click(screen.getByRole("button", { name: "Issue Stock" }));
    expect(movePartAction).toHaveBeenCalledWith(
      expect.objectContaining({
        partId: "p-1",
        txn_type: "issued",
        quantity: "2",
        aircraft_id: "ac-1",
        batch_number: "B1",
        lot_number: "L1",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Now 7 EA on hand.");
  });

  it("offers the chosen aircraft's work orders only", async () => {
    const user = userEvent.setup();
    render(<MoveStockForm {...props} />);
    const orders = () => Array.from(screen.getByLabelText("Work Order").querySelectorAll("option")).map((o) => o.value);
    expect(orders()).toEqual(["", "wo-1", "wo-2"]);
    await user.selectOptions(screen.getByLabelText("Work Order"), "wo-2");
    await user.selectOptions(screen.getByLabelText("Aircraft"), "ac-1");
    expect(orders()).toEqual(["", "wo-1"]);
    expect(screen.getByLabelText("Work Order")).toHaveValue("");
  });

  it("asks no aircraft for stock coming in, and sends none if one was picked first", async () => {
    const user = userEvent.setup();
    render(<MoveStockForm {...props} />);
    await user.selectOptions(screen.getByLabelText("Aircraft"), "ac-1");
    await user.selectOptions(screen.getByLabelText("Move"), "received");
    expect(screen.queryByLabelText("Aircraft")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Receive Stock" }));
    expect(movePartAction).toHaveBeenCalledWith(expect.objectContaining({ txn_type: "received", aircraft_id: "", work_order_id: "" }));
  });

  it("starts an expired part on Receive, since it can't be issued", () => {
    render(<MoveStockForm {...props} expired />);
    expect(screen.getByLabelText("Move")).toHaveValue("received");
  });

  it("says what the server refused", async () => {
    movePartAction.mockResolvedValue({ ok: false, message: "Only 2 EA of CH48110-1 on hand." });
    const user = userEvent.setup();
    render(<MoveStockForm {...props} />);
    await user.click(screen.getByRole("button", { name: "Issue Stock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only 2 EA");
  });
});
