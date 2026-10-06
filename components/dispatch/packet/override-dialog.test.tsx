import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComplianceFinding } from "@/lib/api/types";

const { refresh, push, createOverridesAction } = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  createOverridesAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
  useSearchParams: () => new URLSearchParams("flight=f-1"),
}));
vi.mock("./override-actions", () => ({ createOverridesAction }));

import { OverrideDialog } from "./override-dialog";

const block: ComplianceFinding = {
  currency_item_id: "i-1",
  code: "competency_check",
  name: "Initial Competency Check",
  regulation: "14 CFR 135.293(a)",
  status: "non_current",
  last_completed_date: null,
  grace_month_end: null,
  message: "Past its grace month.",
};

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  createOverridesAction.mockReset();
});

describe("OverrideDialog", () => {
  it("records the override for the flight and lets the page read it back", async () => {
    // The page learns of it from the record (the PIC check's override_id),
    // not a flag in this browser's URL: the dispatcher releasing is
    // usually in another browser (29 Sep).
    createOverridesAction.mockResolvedValueOnce({ status: "ok", count: 1 });
    const user = userEvent.setup();
    render(
      <OverrideDialog pilotUserId="p-1" pilotName="Alice Chen" hardBlocks={[block]} flightId="f-1" />,
    );
    await user.click(screen.getByRole("button", { name: "Supervisor Override…" }));
    // One change event per field: typing key by key times out on a busy
    // box, and the timed-out test keeps typing into the next one.
    fireEvent.change(screen.getByLabelText(/Supervisor cert number/), {
      target: { value: "CP-4411" },
    });
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: {
        value: "Checkride booked for Thursday; released for one leg under a documented mitigation.",
      },
    });
    await user.click(screen.getByRole("button", { name: "Record override" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(createOverridesAction).toHaveBeenCalledWith(
      "p-1",
      [{ currency_item_id: "i-1" }],
      "CP-4411",
      "Checkride booked for Thursday; released for one leg under a documented mitigation.",
      "f-1",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("overrides an aircraft type block by its type (#46)", async () => {
    createOverridesAction.mockResolvedValueOnce({ status: "ok", count: 2 });
    const typeBlock: ComplianceFinding = {
      ...block,
      currency_item_id: null,
      airframe_type: "caravan",
      code: "type_qualification",
      name: "PIC on CARAVAN",
      regulation: "14 CFR 135.293 / 135.297",
      message: "Not authorised as PIC on the CARAVAN.",
    };
    const user = userEvent.setup();
    render(
      <OverrideDialog
        pilotUserId="p-1"
        pilotName="Alice Chen"
        hardBlocks={[block, typeBlock]}
        flightId="f-1"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Supervisor Override…" }));
    expect(screen.getByText("PIC on CARAVAN")).toBeInTheDocument();
    // One change event per field: typing key by key times out on a busy box.
    fireEvent.change(screen.getByLabelText(/Supervisor cert number/), {
      target: { value: "CP-4411" },
    });
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Check ride booked for Thursday; the DO approved this one leg by phone." },
    });
    await user.click(screen.getByRole("button", { name: "Record overrides (2)" }));

    await waitFor(() =>
      expect(createOverridesAction).toHaveBeenCalledWith(
        "p-1",
        [{ currency_item_id: "i-1" }, { airframe_type: "caravan" }],
        "CP-4411",
        "Check ride booked for Thursday; the DO approved this one leg by phone.",
        "f-1",
      ),
    );
  });
});
