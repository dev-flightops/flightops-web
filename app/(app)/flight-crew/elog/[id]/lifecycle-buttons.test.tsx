import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reopenFlightLogAction, deleteFlightLogAction } = vi.hoisted(() => ({
  reopenFlightLogAction: vi.fn(),
  deleteFlightLogAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./lifecycle-actions", () => ({
  reopenFlightLogAction,
  deleteFlightLogAction,
}));

import { LifecycleButtons } from "./lifecycle-buttons";

beforeEach(() => {
  reopenFlightLogAction.mockReset();
  deleteFlightLogAction.mockReset();
});

const yesterday = () =>
  new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const ninetyOneDaysAgo = () =>
  new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();

describe("LifecycleButtons", () => {
  it("shows only Delete for a draft log", () => {
    render(
      <LifecycleButtons logId="log-1" status="draft" submittedAt={null} />,
    );
    expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("shows both Reopen and Delete for a submitted log within window", () => {
    render(
      <LifecycleButtons
        logId="log-1"
        status="submitted"
        submittedAt={yesterday()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /reopen/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("hides Reopen and Delete when the submitted log is past 90 days", () => {
    render(
      <LifecycleButtons
        logId="log-1"
        status="submitted"
        submittedAt={ninetyOneDaysAgo()}
      />,
    );
    expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("hides Reopen + Delete when submittedAt fails to parse on a submitted log", () => {
    render(
      <LifecycleButtons
        logId="log-1"
        status="submitted"
        submittedAt="not-a-date"
      />,
    );
    expect(screen.queryByRole("button", { name: /reopen/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("opens the confirm panel when Reopen is clicked", () => {
    render(
      <LifecycleButtons
        logId="log-1"
        status="submitted"
        submittedAt={yesterday()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^reopen$/i }));
    expect(
      screen.getByText(/reopen this log for editing/i),
    ).toBeInTheDocument();
    // Reason textarea + Confirm + Cancel buttons appear.
    expect(screen.getByLabelText(/reason \(optional\)/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^cancel$/i }),
    ).toBeInTheDocument();
  });

  it("Cancel closes the panel without invoking the action", () => {
    render(
      <LifecycleButtons logId="log-1" status="draft" submittedAt={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByLabelText(/reason/i)).toBeNull();
    expect(deleteFlightLogAction).not.toHaveBeenCalled();
  });
});
