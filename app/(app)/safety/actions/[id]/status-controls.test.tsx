import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateStatusAction: vi.fn() }));
// Tests use React 18; only the unavailable server-action hook is shimmed.
// Real useState and rerenders reproduce the stale-selection failure.
vi.mock("react", async () => ({
  ...await vi.importActual<typeof import("react")>("react"),
  useActionState: () => [{ status: "idle" }, undefined, false],
}));
import { StatusControls } from "./status-controls";

it("shows the required closure reason after an action refresh changes Open to In Progress", () => {
  const { rerender } = render(<StatusControls capaId="action" currentStatus="open" />);
  expect(screen.getByRole("combobox")).toHaveValue("in_progress");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  rerender(<StatusControls capaId="action" currentStatus="in_progress" />);
  expect(screen.getByRole("combobox")).toHaveValue("closed");
  expect(screen.getByRole("textbox", { name: "Closure reason (required)" })).toBeRequired();
  rerender(<StatusControls capaId="action" currentStatus="closed" />);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
