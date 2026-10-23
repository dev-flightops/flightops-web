import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CheckInConfig, CheckInCustomField } from "@/lib/api/check-in";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const actions = vi.hoisted(() => ({
  addCheckInFieldAction: vi.fn(),
  saveCheckInRulesAction: vi.fn(),
  setCheckInFieldAction: vi.fn(),
}));
vi.mock("./actions", () => actions);

import { CheckInSettings } from "./check-in-settings";

const CONFIG: CheckInConfig = {
  id: "cfg",
  require_actual_weight: false,
  require_actual_bag_weight: false,
  require_bags_count: true,
  require_id_verification: true,
  require_hazmat_declaration: true,
  require_seat_assignment: false,
  no_show_fee_enabled: false,
  no_show_fee_amount: null,
  standby_enabled: true,
  allow_walk_up: true,
  lock_manifest_on_close: true,
};

const VILLAGE: CheckInCustomField = {
  id: "cf-1",
  field_key: "village",
  field_label: "Home village",
  field_type: "dropdown",
  field_options: "Bethel\nEmmonak",
  is_required: true,
  sort_order: 1,
  is_active: true,
  help_text: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Settings → Check-in (#103)", () => {
  it("saves what check-in requires and the no-show fee", async () => {
    actions.saveCheckInRulesAction.mockResolvedValue({ ok: true });
    render(<CheckInSettings config={CONFIG} fields={[]} canEdit />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Actual weight" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Charge a no-show fee" }));
    fireEvent.change(screen.getByLabelText("No-show fee in dollars"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Check-in Settings" }));
    await waitFor(() => expect(actions.saveCheckInRulesAction).toHaveBeenCalled());
    expect(actions.saveCheckInRulesAction.mock.calls[0][0]).toMatchObject({
      require_actual_weight: true,
      no_show_fee_enabled: true,
      no_show_fee_amount: 75,
    });
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("lists the company's fields and turns one off", async () => {
    actions.setCheckInFieldAction.mockResolvedValue({ ok: true });
    render(<CheckInSettings config={CONFIG} fields={[VILLAGE]} canEdit />);
    expect(screen.getByText("Bethel · Emmonak")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Home village in use" }));
    await waitFor(() =>
      expect(actions.setCheckInFieldAction).toHaveBeenCalledWith("cf-1", { is_active: false }),
    );
  });

  it("adds a dropdown field with its options", async () => {
    actions.addCheckInFieldAction.mockResolvedValue({ ok: true });
    render(<CheckInSettings config={CONFIG} fields={[VILLAGE]} canEdit />);
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Medical escort" } });
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "escort" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dropdown" } });
    fireEvent.change(screen.getByLabelText("Options, one per line"), { target: { value: "Yes\nNo" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Field" }));
    await waitFor(() =>
      expect(actions.addCheckInFieldAction).toHaveBeenCalledWith(
        expect.objectContaining({
          field_key: "escort",
          field_label: "Medical escort",
          field_type: "dropdown",
          field_options: "Yes\nNo",
          sort_order: 2,
        }),
      ),
    );
  });

  it("is read-only below the Chief Pilot, DO and Exec Admin", () => {
    render(<CheckInSettings config={CONFIG} fields={[VILLAGE]} canEdit={false} />);
    expect(screen.getByRole("checkbox", { name: "Actual weight" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save Check-in Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Field" })).not.toBeInTheDocument();
  });
});
