import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComplianceSettings } from "@/lib/api/type-qualifications";

const { setTypeQualificationGateAction } = vi.hoisted(() => ({
  setTypeQualificationGateAction: vi.fn(),
}));
vi.mock("./actions", () => ({ setTypeQualificationGateAction }));

import { TypeGateCard } from "./type-gate-card";

const OFF: ComplianceSettings = {
  enforce_type_qualifications: false,
  type_qualifications_changed_at: null,
  type_qualifications_changed_by: null,
};
const ON: ComplianceSettings = {
  enforce_type_qualifications: true,
  type_qualifications_changed_at: "2026-10-06T02:10:00Z",
  type_qualifications_changed_by: {
    id: "u-do",
    full_name: "Drew Director",
    email: "do@example.test",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TypeGateCard", () => {
  it("ships off, and says so", () => {
    render(<TypeGateCard settings={OFF} canChange />);
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.getByText("Off — never switched on.")).toBeInTheDocument();
  });

  it("turns on only after a second, explicit click", async () => {
    setTypeQualificationGateAction.mockResolvedValue({ ok: true });
    render(<TypeGateCard settings={OFF} canChange />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on…" }));
    expect(setTypeQualificationGateAction).not.toHaveBeenCalled();
    expect(
      screen.getByText("Turn on? Releases for a PIC not current on the type will be refused."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() => expect(setTypeQualificationGateAction).toHaveBeenCalledWith(true));
  });

  it("says who switched it on, and turns off the same way", async () => {
    setTypeQualificationGateAction.mockResolvedValue({ ok: true });
    render(<TypeGateCard settings={ON} canChange />);
    expect(screen.getByText("On since 2026-10-06, by Drew Director.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn off…" }));
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(setTypeQualificationGateAction).toHaveBeenCalledWith(false));
  });

  it("shows the refusal when the service says no", async () => {
    setTypeQualificationGateAction.mockResolvedValue({
      ok: false,
      error: "Only the Director of Operations or an Exec Admin can change this.",
    });
    render(<TypeGateCard settings={OFF} canChange />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on…" }));
    fireEvent.click(screen.getByRole("button", { name: "Turn on" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only the Director of Operations or an Exec Admin can change this.",
    );
  });

  it("offers a Chief Pilot no switch, and says who can", () => {
    render(<TypeGateCard settings={OFF} canChange={false} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByText("The Director of Operations or an Exec Admin can change this."),
    ).toBeInTheDocument();
  });
});
