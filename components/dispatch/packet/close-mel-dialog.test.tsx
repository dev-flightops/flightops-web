import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted spies for the server action + router. Same pattern as
// mel-deferral-dialog.test / squawk-dialog.test.
const { closeMelDeferralAction, routerRefresh } = vi.hoisted(() => ({
  closeMelDeferralAction: vi.fn(),
  routerRefresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/maintenance-actions", () => ({
  closeMelDeferralAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

import { CloseMelDialog } from "./close-mel-dialog";

describe("CloseMelDialog", () => {
  beforeEach(() => {
    closeMelDeferralAction.mockReset();
    routerRefresh.mockReset();
  });

  it("opens on the Close button click and shows the ATA chapter + description", async () => {
    const user = userEvent.setup();
    render(
      <CloseMelDialog
        melItemId="mel-1"
        ataChapter="21-30"
        description="Cabin pressurization controller intermittent"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Close$/i }));

    expect(screen.getByText(/Close MEL · ATA 21-30/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Cabin pressurization controller intermittent/),
    ).toBeInTheDocument();
  });

  it("submits with optional notes (empty stays null on the wire)", async () => {
    const user = userEvent.setup();
    closeMelDeferralAction.mockResolvedValueOnce({ ok: true });

    render(
      <CloseMelDialog
        melItemId="mel-1"
        ataChapter="21-30"
        description="X"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Close$/i }));
    await user.click(screen.getByRole("button", { name: /Close MEL/i }));

    await waitFor(() => {
      expect(closeMelDeferralAction).toHaveBeenCalledWith("mel-1", {
        notes: null,
      });
    });
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("submits with notes when the user fills them in", async () => {
    const user = userEvent.setup();
    closeMelDeferralAction.mockResolvedValueOnce({ ok: true });

    render(
      <CloseMelDialog
        melItemId="mel-1"
        ataChapter="21-30"
        description="X"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Close$/i }));
    await user.type(
      screen.getByLabelText(/Closing notes/i),
      "Replaced controller P/N 1234-AB; tested OK.",
    );
    await user.click(screen.getByRole("button", { name: /Close MEL/i }));

    await waitFor(() => {
      expect(closeMelDeferralAction).toHaveBeenCalledWith("mel-1", {
        notes: "Replaced controller P/N 1234-AB; tested OK.",
      });
    });
  });

  it("surfaces the server-action error inline without closing the dialog", async () => {
    const user = userEvent.setup();
    closeMelDeferralAction.mockResolvedValueOnce({
      ok: false,
      error: "This MEL item is already closed.",
    });

    render(
      <CloseMelDialog
        melItemId="mel-1"
        ataChapter="21-30"
        description="X"
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Close$/i }));
    await user.click(screen.getByRole("button", { name: /Close MEL/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /already closed/i,
      );
    });
    expect(screen.getByText(/Close MEL · ATA 21-30/i)).toBeInTheDocument();
    expect(routerRefresh).not.toHaveBeenCalled();
  });
});
