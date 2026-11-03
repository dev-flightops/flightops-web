import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("completing resolves its squawk with the note, unless told not to", async () => {
    const user = userEvent.setup();
    render(
      <WorkOrderActions workOrderId="wo-1" next={["awaiting_parts", "completed", "closed"]} squawk={{ id: "sq-1", grounding: true }} />,
    );
    expect(screen.getByText(/returns the aircraft to service/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Note/), "Replaced the left nav bulb; tested OK");
    await user.click(screen.getByRole("button", { name: "Mark completed" }));
    expect(transitionWorkOrderAction).toHaveBeenLastCalledWith({
      workOrderId: "wo-1",
      toStatus: "completed",
      note: "Replaced the left nav bulb; tested OK",
      resolveSquawkId: "sq-1",
    });
    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByLabelText(/Note/), "Parts on order");
    await user.click(screen.getByRole("button", { name: "Awaiting parts" }));
    expect(transitionWorkOrderAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ toStatus: "awaiting_parts", resolveSquawkId: null }),
    );
  });

  it("shows why a move was refused", async () => {
    const user = userEvent.setup();
    transitionWorkOrderAction.mockResolvedValueOnce({ ok: false, message: "Say what was done." });
    render(<WorkOrderActions workOrderId="wo-1" next={["completed"]} squawk={{ id: "sq-1", grounding: false }} />);
    await user.click(screen.getByRole("button", { name: "Mark completed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Say what was done.");
  });
});
