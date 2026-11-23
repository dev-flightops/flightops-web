import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fillSignOff, SIGNER } from "@/tests/sign-off";

const { transitionWorkOrderAction } = vi.hoisted(() => ({ transitionWorkOrderAction: vi.fn() }));
vi.mock("../actions", () => ({ transitionWorkOrderAction }));

import { WorkOrderActions } from "./work-order-actions";

beforeEach(() => {
  transitionWorkOrderAction.mockReset();
  transitionWorkOrderAction.mockResolvedValue({ ok: true });
});

describe("a work order's next step (#134)", () => {
  it("offers the moves its state allows", () => {
    render(<WorkOrderActions workOrderId="wo-1" next={["in_progress", "awaiting_parts", "closed"]} squawk={null} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Start work", "Awaiting parts", "Close"]);
  });

  it("completing resolves its squawk with the sign-off, unless told not to", async () => {
    const user = userEvent.setup();
    render(
      <WorkOrderActions workOrderId="wo-1" next={["awaiting_parts", "completed", "closed"]} squawk={{ id: "sq-1", grounding: true }} />,
    );
    expect(screen.getByText(/returns the aircraft to service/)).toBeInTheDocument();
    await fillSignOff(user, "Replaced the left nav bulb; tested OK");
    await user.click(screen.getByRole("button", { name: "Mark completed" }));
    expect(transitionWorkOrderAction).toHaveBeenLastCalledWith({
      workOrderId: "wo-1",
      toStatus: "completed",
      note: "",
      closure: null,
      resolveSquawk: {
        id: "sq-1",
        signOff: { work_done: "Replaced the left nav bulb; tested OK", ...SIGNER },
      },
    });
    await user.click(screen.getByRole("checkbox", { name: /Resolve the squawk/ }));
    await user.type(screen.getByLabelText(/Note/), "Parts on order");
    await user.click(screen.getByRole("button", { name: "Awaiting parts" }));
    expect(transitionWorkOrderAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ toStatus: "awaiting_parts", note: "Parts on order", resolveSquawk: null, closure: null }),
    );
  });

  it("won't close with one click (1119-19)", async () => {
    const user = userEvent.setup();
    render(<WorkOrderActions workOrderId="wo-1" next={["closed"]} squawk={null} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/^The sign-off needs the work done/);
    expect(transitionWorkOrderAction).not.toHaveBeenCalled();

    await fillSignOff(user, "Replaced nav light assembly.");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(transitionWorkOrderAction).toHaveBeenLastCalledWith({
      workOrderId: "wo-1",
      toStatus: "closed",
      note: "",
      closure: { sign_off: { work_done: "Replaced nav light assembly.", ...SIGNER } },
      resolveSquawk: null,
    });
  });

  it("closes one opened in error with the reason, and leaves its squawk alone", async () => {
    const user = userEvent.setup();
    render(<WorkOrderActions workOrderId="wo-1" next={["closed"]} squawk={{ id: "sq-1", grounding: true }} />);
    await user.click(screen.getByRole("radio", { name: "No work done" }));
    await user.type(screen.getByLabelText("Why no work was done"), "Duplicate of WO-7.");
    await user.click(screen.getByRole("button", { name: "Close" }));
    // Its squawk can only be resolved with the work signed off.
    expect(await screen.findByRole("alert")).toHaveTextContent(/Untick it to close with no work done/);
    await user.click(screen.getByRole("checkbox", { name: /Resolve the squawk/ }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(transitionWorkOrderAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ closure: { no_work_reason: "Duplicate of WO-7." }, resolveSquawk: null }),
    );
  });

  it("shows why a move was refused", async () => {
    const user = userEvent.setup();
    transitionWorkOrderAction.mockResolvedValueOnce({ ok: false, message: "Only maintenance can do that." });
    render(<WorkOrderActions workOrderId="wo-1" next={["in_progress"]} squawk={null} />);
    await user.click(screen.getByRole("button", { name: "Start work" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only maintenance can do that.");
  });
});
