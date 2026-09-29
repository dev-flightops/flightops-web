import { render, screen, waitFor } from "@testing-library/react";
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
    await user.type(screen.getByLabelText(/Supervisor cert number/), "CP-4411");
    await user.type(
      screen.getByLabelText(/Reason/),
      "Checkride booked for Thursday; released for one leg under a documented mitigation.",
    );
    await user.click(screen.getByRole("button", { name: "Record override" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(createOverridesAction).toHaveBeenCalledWith(
      "p-1",
      ["i-1"],
      "CP-4411",
      "Checkride booked for Thursday; released for one leg under a documented mitigation.",
      "f-1",
    );
    expect(push).not.toHaveBeenCalled();
  });
});
