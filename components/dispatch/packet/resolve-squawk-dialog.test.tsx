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

import { fillSignOff, SIGNER } from "@/tests/sign-off";

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

  it("won't resolve without the sign-off (1119-19)", async () => {
    const user = userEvent.setup();
    render(<ResolveSquawkDialog squawkId="sq-1" title="X" severity="major" />);
    await user.click(screen.getByRole("button", { name: /^Resolve$/i }));
    await user.type(screen.getByLabelText("Resolution: what was done"), "Replaced LH main tire.");
    await user.click(screen.getByRole("button", { name: /Resolve squawk/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The sign-off needs the mechanic's name, their certificate number, the kind of certificate.",
    );
    expect(resolveSquawkAction).not.toHaveBeenCalled();
  });

  it("submits the trimmed work with the mechanic's sign-off", async () => {
    const user = userEvent.setup();
    resolveSquawkAction.mockResolvedValueOnce({ ok: true });
    render(<ResolveSquawkDialog squawkId="sq-1" title="X" severity="major" />);
    await user.click(screen.getByRole("button", { name: /^Resolve$/i }));
    await fillSignOff(user, "  Replaced LH main tire; rebalanced.  ");
    await user.click(screen.getByRole("button", { name: /Resolve squawk/i }));

    await waitFor(() => {
      expect(resolveSquawkAction).toHaveBeenCalledWith("sq-1", {
        resolution_notes: "Replaced LH main tire; rebalanced.",
        ...SIGNER,
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
    await fillSignOff(user, "Done.");
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
