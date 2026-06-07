import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` factories are hoisted above top-level code, so the server-
// action stub has to live in `vi.hoisted`. The action is mocked at its
// module path so the dialog's `import { createMelDeferralAction }` resolves
// to our spy.
const { createMelDeferralAction, routerRefresh } = vi.hoisted(() => ({
  createMelDeferralAction: vi.fn(),
  routerRefresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/maintenance-actions", () => ({
  createMelDeferralAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

import { MelDeferralDialog } from "./mel-deferral-dialog";

describe("MelDeferralDialog", () => {
  beforeEach(() => {
    // Hoisted spies persist across `it` blocks — clear them so call-count
    // assertions don't see actions from previous tests.
    createMelDeferralAction.mockReset();
    routerRefresh.mockReset();
  });

  it("opens on button click and shows the tail number in the title", async () => {
    const user = userEvent.setup();
    render(<MelDeferralDialog aircraftId="ac-1" tailNumber="N207GE" />);

    await user.click(screen.getByRole("button", { name: /mel deferral/i }));

    expect(
      screen.getByText(/New MEL deferral · N207GE/i),
    ).toBeInTheDocument();
  });

  it("defaults due_at to deferred_at + category's max days (C → +10d)", async () => {
    const user = userEvent.setup();
    render(<MelDeferralDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /mel deferral/i }));

    const deferred = screen.getByLabelText(/Deferred at \(UTC\)/i) as HTMLInputElement;
    const due = screen.getByLabelText(/Due by \(UTC\)/i) as HTMLInputElement;

    // Default category is C → 10 days.
    const depDate = new Date(`${deferred.value}:00Z`);
    const dueDate = new Date(`${due.value}:00Z`);
    const diffDays =
      (dueDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(10);
  });

  it("re-suggests due_at when the user changes category, until they manually edit due_at", async () => {
    const user = userEvent.setup();
    render(<MelDeferralDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /mel deferral/i }));

    const deferred = screen.getByLabelText(/Deferred at \(UTC\)/i) as HTMLInputElement;
    const due = screen.getByLabelText(/Due by \(UTC\)/i) as HTMLInputElement;
    const categorySelect = screen.getByLabelText(/Category/i);

    // Switch to B (3 days) — due should re-suggest.
    await user.selectOptions(categorySelect, "B");
    let depDate = new Date(`${deferred.value}:00Z`);
    let dueDate = new Date(`${due.value}:00Z`);
    expect(
      (dueDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24),
    ).toBeCloseTo(3);

    // User manually edits due_at → from now on, category changes should NOT
    // overwrite it.
    await user.clear(due);
    await user.type(due, "2026-12-31T00:00");

    await user.selectOptions(categorySelect, "D");
    expect(due.value).toBe("2026-12-31T00:00");

    // Sanity: deferred_at didn't change either.
    depDate = new Date(`${deferred.value}:00Z`);
    dueDate = new Date(`${due.value}:00Z`);
    expect(dueDate.getUTCFullYear()).toBe(2026);
    expect(dueDate.getUTCMonth()).toBe(11); // December (0-indexed)
  });

  it("submits with the right payload and refreshes the router on success", async () => {
    const user = userEvent.setup();
    createMelDeferralAction.mockResolvedValueOnce({
      ok: true,
      mel_item_id: "mel-1",
    });

    render(<MelDeferralDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /mel deferral/i }));

    await user.type(screen.getByLabelText(/ATA chapter/i), "21-30");
    await user.type(
      screen.getByLabelText(/Description/i),
      "Cabin pressure controller intermittent",
    );

    await user.click(screen.getByRole("button", { name: /file deferral/i }));

    await waitFor(() => {
      expect(createMelDeferralAction).toHaveBeenCalledTimes(1);
    });
    const payload = createMelDeferralAction.mock.calls[0][0];
    expect(payload.aircraft_id).toBe("ac-1");
    expect(payload.ata_chapter).toBe("21-30");
    expect(payload.description).toBe(
      "Cabin pressure controller intermittent",
    );
    expect(payload.category).toBe("C");
    expect(payload.notes).toBeNull();
    // ISO 8601 UTC shape: "...T...Z"
    expect(payload.deferred_at).toMatch(/T.*Z$/);
    expect(payload.due_at).toMatch(/T.*Z$/);

    await waitFor(() => {
      expect(routerRefresh).toHaveBeenCalled();
    });
  });

  it("surfaces the server-action error inline without closing the dialog", async () => {
    const user = userEvent.setup();
    createMelDeferralAction.mockResolvedValueOnce({
      ok: false,
      error: "Aircraft not found.",
    });

    render(<MelDeferralDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /mel deferral/i }));

    await user.type(screen.getByLabelText(/ATA chapter/i), "21-30");
    await user.type(
      screen.getByLabelText(/Description/i),
      "Something",
    );
    await user.click(screen.getByRole("button", { name: /file deferral/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Aircraft not found/i);
    });
    // Dialog still open
    expect(screen.getByText(/New MEL deferral/i)).toBeInTheDocument();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("validates required fields client-side without hitting the server", async () => {
    const user = userEvent.setup();
    createMelDeferralAction.mockReset();

    render(<MelDeferralDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /mel deferral/i }));

    // Don't fill anything; click submit.
    await user.click(screen.getByRole("button", { name: /file deferral/i }));

    // Both required-field messages render (1 per field).
    const requireds = await screen.findAllByText(/required/i);
    expect(requireds.length).toBeGreaterThanOrEqual(2);
    expect(createMelDeferralAction).not.toHaveBeenCalled();
  });

  it("validates due_at must be after deferred_at", async () => {
    const user = userEvent.setup();
    createMelDeferralAction.mockReset();

    render(<MelDeferralDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /mel deferral/i }));

    await user.type(screen.getByLabelText(/ATA chapter/i), "21-30");
    await user.type(screen.getByLabelText(/Description/i), "X");

    const deferred = screen.getByLabelText(/Deferred at \(UTC\)/i);
    const due = screen.getByLabelText(/Due by \(UTC\)/i);
    await user.clear(deferred);
    await user.type(deferred, "2026-12-31T00:00");
    await user.clear(due);
    await user.type(due, "2026-12-01T00:00"); // before deferred

    await user.click(screen.getByRole("button", { name: /file deferral/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Due date must be after the deferred-at date/i),
      ).toBeInTheDocument();
    });
    expect(createMelDeferralAction).not.toHaveBeenCalled();
  });
});
