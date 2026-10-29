import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DutySettingsResult } from "./actions";

const { saveDutySettingsAction, refresh } = vi.hoisted(() => ({
  saveDutySettingsAction: vi.fn<(roles: string[]) => Promise<DutySettingsResult>>(async () => ({ ok: true })),
  refresh: vi.fn(),
}));
vi.mock("./actions", () => ({ saveDutySettingsAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DutySettingsForm } from "./duty-settings";

const DEFAULT = ["chief_pilot", "director_of_operations", "exec_admin"];

beforeEach(() => {
  saveDutySettingsAction.mockClear();
  refresh.mockClear();
});

// #100: who may correct anyone's duty times.
describe("DutySettingsForm", () => {
  it("ticks the roles that may correct anyone's duty times", () => {
    render(<DutySettingsForm correctionRoles={DEFAULT} canEdit />);
    expect(screen.getByRole("checkbox", { name: "Chief Pilot" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Director of Operations" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Exec Admin" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dispatcher" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Pilot" })).not.toBeChecked();
  });

  it("saves the roles ticked, in the catalogue's order", async () => {
    const user = userEvent.setup();
    render(<DutySettingsForm correctionRoles={DEFAULT} canEdit />);
    await user.click(screen.getByRole("checkbox", { name: "Exec Admin" }));
    await user.click(screen.getByRole("checkbox", { name: "Dispatcher" }));
    await user.click(screen.getByRole("button", { name: "Save Duty Corrections" }));
    expect(saveDutySettingsAction).toHaveBeenCalledWith(["director_of_operations", "dispatcher", "chief_pilot"]);
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
    expect(refresh).toHaveBeenCalled();
  });

  it("says why a save was refused", async () => {
    saveDutySettingsAction.mockResolvedValueOnce({ ok: false, error: "Only the Director of Operations or an Exec Admin can change this." });
    const user = userEvent.setup();
    render(<DutySettingsForm correctionRoles={DEFAULT} canEdit />);
    await user.click(screen.getByRole("button", { name: "Save Duty Corrections" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the Director of Operations or an Exec Admin");
  });

  it("is read-only for anyone else, and says who can change it", () => {
    render(<DutySettingsForm correctionRoles={DEFAULT} canEdit={false} />);
    expect(screen.getByRole("checkbox", { name: "Chief Pilot" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save Duty Corrections" })).not.toBeInTheDocument();
    expect(screen.getByText("The Director of Operations or an Exec Admin can change this.")).toBeInTheDocument();
  });
});
