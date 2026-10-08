import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ fileSafetyReportAction: vi.fn() }));
// The label maps come from lib/api, whose client reaches next-auth.
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
// Next runs the form on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import { SafetyReportForm } from "./report-form";

function renderForm(startType?: "asap") {
  return render(
    <SafetyReportForm
      reporterName="Alice Chen"
      today="2026-10-08"
      returnTo={null}
      cancelHref="/safety/mine"
      startType={startType}
    />,
  );
}

describe("filing an ASAP report (#59)", () => {
  it("opens on ASAP from the hub, with no anonymous option and the reason why", () => {
    renderForm("asap");
    expect(screen.getByLabelText("Report Type")).toHaveValue("asap");
    expect(screen.queryByRole("checkbox", { name: "Submit anonymously" })).toBeNull();
    expect(screen.getByText(/An ASAP report carries your name/)).toBeInTheDocument();
    // Named, so the name and department show.
    expect(screen.getByLabelText("Your Name")).toHaveValue("Alice Chen");
  });

  it("brings the anonymous option back for every other type", async () => {
    renderForm("asap");
    await userEvent.setup().selectOptions(screen.getByLabelText("Report Type"), "near_miss");
    expect(screen.getByRole("checkbox", { name: "Submit anonymously" })).toBeInTheDocument();
  });

  it("sends a report as named once ASAP is chosen, even if anonymous was ticked first", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("checkbox", { name: "Submit anonymously" }));
    expect(screen.queryByLabelText("Department")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Report Type"), "asap");
    expect(screen.queryByRole("checkbox", { name: "Submit anonymously" })).toBeNull();
    expect(screen.getByLabelText("Department")).toBeInTheDocument();
  });
});
