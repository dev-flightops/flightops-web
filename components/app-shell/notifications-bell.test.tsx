import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import type { OperationalAlert } from "@/lib/dashboards/operational-snapshot";

import type { DismissResult } from "./notifications-actions";
import { NotificationsBell } from "./notifications-bell";

/**
 * The top-bar bell.
 *
 * The cases worth pinning: the badge takes the colour of the worst
 * alert behind it rather than always being red; dismissing says what
 * it does and does not do; and an unreadable dismissal list shows
 * every alert rather than none.
 */

beforeEach(() => refresh.mockReset());

function alert(over: Partial<OperationalAlert> = {}): OperationalAlert {
  return {
    id: "grounded-abc",
    severity: "red",
    category: "aircraft_grounded",
    title: "Aircraft grounded — N200PA",
    detail: "1 blocking issue open. Cannot dispatch.",
    href: "/maintenance/aircraft/abc",
    occurredAt: "2026-09-10T08:00:00Z",
    ...over,
  };
}

const MEL = alert({
  id: "mel-soon-1",
  severity: "yellow",
  category: "mel_expiring",
  title: "MEL expiring — N100PA · ATA 34",
  detail: "6h remaining",
});

function bell(
  over: {
    alerts?: OperationalAlert[];
    dismissedCount?: number;
    filterUnavailable?: boolean;
    dismissAction?: (
      key: string,
      occurrenceAt: string,
    ) => Promise<DismissResult>;
  } = {},
) {
  const action =
    over.dismissAction ?? vi.fn(async (): Promise<DismissResult> => ({ status: "ok" }));
  render(
    <NotificationsBell
      alerts={over.alerts ?? [alert()]}
      dismissedCount={over.dismissedCount ?? 0}
      filterUnavailable={over.filterUnavailable ?? false}
      dismissAction={action}
    />,
  );
  return action;
}

describe("the badge", () => {
  it("counts what is outstanding", () => {
    bell({ alerts: [alert(), MEL] });
    expect(screen.getByTestId("bell-count")).toHaveTextContent("2");
  });

  it("shows nothing at all when nothing is outstanding", () => {
    // Not a zero. A badge reading 0 is visual noise that says the same
    // thing as no badge.
    bell({ alerts: [] });
    expect(screen.queryByTestId("bell-count")).not.toBeInTheDocument();
  });

  it("takes the colour of the worst alert, not always red", () => {
    // A badge that is always red teaches people to ignore it. Three
    // yellow MELs should not look like a grounded aircraft.
    bell({ alerts: [MEL] });
    expect(screen.getByTestId("bell-count").className).toMatch(
      /bg-status-yellow/,
    );
  });

  it("goes red as soon as one red alert is present", () => {
    bell({ alerts: [MEL, alert()] });
    expect(screen.getByTestId("bell-count").className).toMatch(/bg-status-red/);
  });

  it("says the count in its accessible name", () => {
    bell({ alerts: [alert(), MEL] });
    expect(
      screen.getByRole("button", { name: "Notifications — 2 outstanding" }),
    ).toBeInTheDocument();
  });
});

describe("the panel", () => {
  it("opens on click and lists each alert with its detail", async () => {
    const user = userEvent.setup();
    bell({ alerts: [alert(), MEL] });
    await user.click(screen.getByRole("button", { name: /Notifications/ }));

    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("Aircraft grounded — N200PA")).toBeInTheDocument();
    expect(
      screen.getByText("1 blocking issue open. Cannot dispatch."),
    ).toBeInTheDocument();
  });

  it("links each alert at its source record", async () => {
    const user = userEvent.setup();
    bell();
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(
      screen.getByRole("link", { name: "Aircraft grounded — N200PA" }),
    ).toHaveAttribute("href", "/maintenance/aircraft/abc");
  });

  it("closes on Escape", async () => {
    // A dropdown in a top bar that only closes via its own button
    // traps a keyboard user.
    const user = userEvent.setup();
    bell();
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("distinguishes nothing-wrong from everything-dismissed", async () => {
    // An empty bell and a cleared bell are different states, and the
    // second one is the operator's own doing.
    const user = userEvent.setup();
    bell({ alerts: [], dismissedCount: 3 });
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(
      screen.getByText("Everything current has been dismissed."),
    ).toBeInTheDocument();
  });

  it("names what it checked when there is genuinely nothing", async () => {
    const user = userEvent.setup();
    bell({ alerts: [], dismissedCount: 0 });
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(
      screen.getByText(/No grounded aircraft, overdue flights or expiring MELs/),
    ).toBeInTheDocument();
  });
});

describe("dismissing", () => {
  it("sends the alert's id and its occurrence", async () => {
    // The occurrence is what stops a re-grounding being swallowed by
    // the old dismissal.
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<DismissResult> => ({ status: "ok" }));
    bell({ dismissAction: action });
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    await user.click(
      screen.getByRole("button", { name: /Dismiss Aircraft grounded/ }),
    );
    expect(action).toHaveBeenCalledWith(
      "grounded-abc",
      "2026-09-10T08:00:00Z",
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says dismissing hides rather than resolves", async () => {
    // The aircraft is still grounded. A bell that hid alerts without
    // saying so would be a worse picture of the operation than the
    // dashboards it draws from.
    const user = userEvent.setup();
    bell({ dismissedCount: 2 });
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(
      screen.getByText(/does not\s+resolve it/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "unfiltered list" }),
    ).toHaveAttribute("href", "/home");
  });

  it("surfaces a refusal instead of silently failing", async () => {
    const user = userEvent.setup();
    bell({
      dismissAction: vi.fn(
        async (): Promise<DismissResult> => ({
          status: "error",
          message: "Not saved (HTTP 500).",
        }),
      ),
    });
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    await user.click(screen.getByRole("button", { name: /Dismiss/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not saved");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("when the dismissal list cannot be read", () => {
  it("says the view is unfiltered rather than implying it is clear", async () => {
    // Failing towards "you have things to look at" is the safe
    // direction for an alert surface.
    const user = userEvent.setup();
    bell({ alerts: [alert()], filterUnavailable: true });
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(
      screen.getByText(/Showing every alert — your dismissals could not be read/),
    ).toBeInTheDocument();
  });
});
