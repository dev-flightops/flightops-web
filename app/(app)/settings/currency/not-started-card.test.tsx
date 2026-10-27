import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setNotStartedBlocksAction } = vi.hoisted(() => ({ setNotStartedBlocksAction: vi.fn() }));
vi.mock("./actions", () => ({ setNotStartedBlocksAction }));

import type { ComplianceSettings } from "@/lib/api/type-qualifications";

import { NotStartedCard } from "./not-started-card";

const OFF: ComplianceSettings = {
  enforce_type_qualifications: false,
  type_qualifications_changed_at: null,
  type_qualifications_changed_by: null,
  first_class_medical_types: [],
  first_class_medical_changed_at: null,
  first_class_medical_changed_by: null,
  not_started_blocks: false,
};

describe("NotStartedCard (#99)", () => {
  beforeEach(() => {
    setNotStartedBlocksAction.mockReset().mockResolvedValue({ ok: true });
  });

  it("is off to start, and turning it on takes two clicks", async () => {
    render(<NotStartedCard settings={OFF} canChange />);
    expect(screen.getByText("Off — never switched on.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Turn on…" }));
    expect(
      screen.getByText("Turn on? Pilots with a record never entered won't be offered or released."),
    ).toBeInTheDocument();
    expect(setNotStartedBlocksAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(setNotStartedBlocksAction).toHaveBeenCalledWith(true));
  });

  it("says who changed it, and only the DO or an exec admin can", () => {
    render(
      <NotStartedCard
        settings={{
          ...OFF,
          not_started_blocks: true,
          not_started_changed_at: "2026-10-27T09:00:00Z",
          not_started_changed_by: { id: "u-do", full_name: "Dee Director", email: "do@x" },
        }}
        canChange={false}
      />,
    );
    expect(screen.getByText("On since 2026-10-27, by Dee Director.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("The Director of Operations or an Exec Admin can change this.")).toBeInTheDocument();
  });
});
