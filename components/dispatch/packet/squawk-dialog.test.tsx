import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Same hoisted-mock pattern as mel-deferral-dialog.test.tsx.
const { createSquawkAction, routerRefresh } = vi.hoisted(() => ({
  createSquawkAction: vi.fn(),
  routerRefresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/maintenance-actions", () => ({
  createSquawkAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

import { SquawkDialog } from "./squawk-dialog";

describe("SquawkDialog", () => {
  beforeEach(() => {
    createSquawkAction.mockReset();
    routerRefresh.mockReset();
  });

  it("opens on button click and shows the tail number in the title", async () => {
    const user = userEvent.setup();
    render(<SquawkDialog aircraftId="ac-1" tailNumber="N207GE" />);

    await user.click(screen.getByRole("button", { name: /^squawk$/i }));

    expect(screen.getByText(/New squawk · N207GE/i)).toBeInTheDocument();
  });

  it("defaults severity to minor", async () => {
    const user = userEvent.setup();
    render(<SquawkDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /^squawk$/i }));

    const severity = screen.getByLabelText(/Severity/i) as HTMLSelectElement;
    expect(severity.value).toBe("minor");
  });

  it("shows the dispatch-blocking warning strip only when severity=grounding", async () => {
    const user = userEvent.setup();
    render(<SquawkDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /^squawk$/i }));

    // Minor (default) → no warning
    expect(
      screen.queryByText(/block dispatch on/i),
    ).not.toBeInTheDocument();

    // Major → still no warning
    await user.selectOptions(screen.getByLabelText(/Severity/i), "major");
    expect(
      screen.queryByText(/block dispatch on/i),
    ).not.toBeInTheDocument();

    // Grounding → warning appears
    await user.selectOptions(screen.getByLabelText(/Severity/i), "grounding");
    expect(
      screen.getByText(/block dispatch on/i),
    ).toBeInTheDocument();
  });

  it("submits with the right payload and refreshes the router on success", async () => {
    const user = userEvent.setup();
    createSquawkAction.mockResolvedValueOnce({
      ok: true,
      squawk_id: "sq-1",
    });

    render(<SquawkDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /^squawk$/i }));

    await user.type(
      screen.getByLabelText(/Title/i),
      "Left main gear tire wear approaching limits",
    );
    await user.type(
      screen.getByLabelText(/Description/i),
      "Cord visible on outboard shoulder post-flight.",
    );
    await user.selectOptions(
      screen.getByLabelText(/Severity/i),
      "major",
    );

    await user.click(screen.getByRole("button", { name: /file squawk/i }));

    await waitFor(() => {
      expect(createSquawkAction).toHaveBeenCalledTimes(1);
    });
    const payload = createSquawkAction.mock.calls[0][0];
    expect(payload.aircraft_id).toBe("ac-1");
    expect(payload.title).toBe(
      "Left main gear tire wear approaching limits",
    );
    expect(payload.description).toBe(
      "Cord visible on outboard shoulder post-flight.",
    );
    expect(payload.severity).toBe("major");
    expect(payload.reported_at).toMatch(/T.*Z$/);

    await waitFor(() => {
      expect(routerRefresh).toHaveBeenCalled();
    });
  });

  it("surfaces the server-action error inline without closing the dialog", async () => {
    const user = userEvent.setup();
    createSquawkAction.mockResolvedValueOnce({
      ok: false,
      error: "Aircraft not found.",
    });

    render(<SquawkDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /^squawk$/i }));

    await user.type(screen.getByLabelText(/Title/i), "Something");
    await user.type(screen.getByLabelText(/Description/i), "Detail");
    await user.click(screen.getByRole("button", { name: /file squawk/i }));

    await waitFor(() => {
      expect(
        screen.getAllByRole("alert").some((el) =>
          /Aircraft not found/i.test(el.textContent ?? ""),
        ),
      ).toBe(true);
    });
    expect(screen.getByText(/New squawk/i)).toBeInTheDocument();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("validates required fields client-side without hitting the server", async () => {
    const user = userEvent.setup();
    createSquawkAction.mockReset();

    render(<SquawkDialog aircraftId="ac-1" tailNumber="N207GE" />);
    await user.click(screen.getByRole("button", { name: /^squawk$/i }));

    await user.click(screen.getByRole("button", { name: /file squawk/i }));

    const requireds = await screen.findAllByText(/required/i);
    expect(requireds.length).toBeGreaterThanOrEqual(2); // title + description
    expect(createSquawkAction).not.toHaveBeenCalled();
  });
});
