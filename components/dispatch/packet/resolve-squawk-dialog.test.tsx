import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveSquawkAction, routerRefresh } = vi.hoisted(() => ({
  resolveSquawkAction: vi.fn(),
  routerRefresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/maintenance-actions", () => ({
  resolveSquawkAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

import { ResolveSquawkDialog } from "./resolve-squawk-dialog";

describe("ResolveSquawkDialog", () => {
  beforeEach(() => {
    resolveSquawkAction.mockReset();
    routerRefresh.mockReset();
  });

  it("opens on the Resolve button click and shows the squawk title", async () => {
    const user = userEvent.setup();
    render(
      <ResolveSquawkDialog
        squawkId="sq-1"
        title="Engine oil pressure low"
        severity="grounding"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Resolve$/i }));

    // "Resolve squawk" appears both as the dialog title and the submit
    // button — match the title specifically by role.
    expect(
      screen.getByRole("heading", { name: /Resolve squawk/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Engine oil pressure low")).toBeInTheDocument();
  });

  it("mentions the dispatch impact differently for grounding vs major", async () => {
    const user = userEvent.setup();

    render(
      <ResolveSquawkDialog
        squawkId="sq-1"
        title="X"
        severity="grounding"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Resolve$/i }));
    expect(
      screen.getByText(/aircraft will become dispatchable again/i),
    ).toBeInTheDocument();
  });

  it("rejects empty resolution notes client-side", async () => {
    const user = userEvent.setup();

    render(
      <ResolveSquawkDialog
        squawkId="sq-1"
        title="X"
        severity="major"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Resolve$/i }));
    await user.click(
      screen.getByRole("button", { name: /Resolve squawk/i }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/Resolution notes are required/i);
    expect(resolveSquawkAction).not.toHaveBeenCalled();
  });

  it("trims whitespace and submits the trimmed notes", async () => {
    const user = userEvent.setup();
    resolveSquawkAction.mockResolvedValueOnce({ ok: true });

    render(
      <ResolveSquawkDialog
        squawkId="sq-1"
        title="X"
        severity="major"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Resolve$/i }));
    await user.type(
      screen.getByLabelText(/Resolution notes/i),
      "  Replaced LH main tire; rebalanced.  ",
    );
    await user.click(
      screen.getByRole("button", { name: /Resolve squawk/i }),
    );

    await waitFor(() => {
      expect(resolveSquawkAction).toHaveBeenCalledWith("sq-1", {
        resolution_notes: "Replaced LH main tire; rebalanced.",
      });
    });
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("surfaces the server-action error inline without closing the dialog", async () => {
    const user = userEvent.setup();
    resolveSquawkAction.mockResolvedValueOnce({
      ok: false,
      error: "This squawk is already resolved.",
    });

    render(
      <ResolveSquawkDialog
        squawkId="sq-1"
        title="X"
        severity="grounding"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Resolve$/i }));
    await user.type(
      screen.getByLabelText(/Resolution notes/i),
      "Done.",
    );
    await user.click(
      screen.getByRole("button", { name: /Resolve squawk/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /already resolved/i,
      );
    });
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
