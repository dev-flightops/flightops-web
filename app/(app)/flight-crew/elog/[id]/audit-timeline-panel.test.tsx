import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFlightLogAuditTimeline, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { getFlightLogAuditTimeline: vi.fn(), TestApiError };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getFlightLogAuditTimeline }));

import { AuditTimelinePanel } from "./audit-timeline-panel";
import type { AuditTimelineEvent } from "@/lib/api/types";

function event(
  over: Partial<AuditTimelineEvent> &
    Pick<AuditTimelineEvent, "kind" | "occurred_at">,
): AuditTimelineEvent {
  return {
    actor: { id: "u-1", full_name: "Pilot", email: "p@x.test" },
    note: null,
    ...over,
  };
}

async function renderPanel() {
  const ui = await AuditTimelinePanel({ logId: "log-1" });
  return render(ui);
}

beforeEach(() => {
  getFlightLogAuditTimeline.mockReset();
});

describe("AuditTimelinePanel", () => {
  it("renders the empty state when there are no events", async () => {
    getFlightLogAuditTimeline.mockResolvedValueOnce({ items: [] });
    await renderPanel();
    expect(screen.getByText(/no lifecycle events yet/i)).toBeInTheDocument();
    // Count badge is hidden when empty.
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  it("renders an event count badge in the summary when events exist", async () => {
    getFlightLogAuditTimeline.mockResolvedValueOnce({
      items: [
        event({ kind: "submit", occurred_at: "2026-06-15T12:00:00Z" }),
        event({ kind: "reopen", occurred_at: "2026-06-16T09:00:00Z" }),
      ],
    });
    await renderPanel();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders the kind label, actor, formatted timestamp, and note for each event", async () => {
    getFlightLogAuditTimeline.mockResolvedValueOnce({
      items: [
        event({
          kind: "submit",
          occurred_at: "2026-06-15T12:00:00Z",
          actor: { id: "u-1", full_name: "Sarah", email: "s@x.test" },
        }),
        event({
          kind: "reopen",
          occurred_at: "2026-06-16T09:30:00Z",
          actor: { id: "u-1", full_name: "Sarah", email: "s@x.test" },
          note: "Forgot to log the night landing.",
        }),
      ],
    });
    await renderPanel();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Reopened")).toBeInTheDocument();
    // Actor names render at least once each event (here twice from same actor).
    expect(screen.getAllByText(/Sarah/)).toHaveLength(2);
    // Formatted timestamp slice "YYYY-MM-DD HH:MMZ".
    expect(screen.getByText("2026-06-15 12:00Z")).toBeInTheDocument();
    expect(screen.getByText("2026-06-16 09:30Z")).toBeInTheDocument();
    // Note quoted.
    expect(
      screen.getByText(/Forgot to log the night landing/),
    ).toBeInTheDocument();
  });

  it("renders all CP-review kinds with friendly labels", async () => {
    getFlightLogAuditTimeline.mockResolvedValueOnce({
      items: [
        event({
          kind: "cp_review_requested",
          occurred_at: "2026-06-20T10:00:00Z",
        }),
        event({
          kind: "cp_review_approved",
          occurred_at: "2026-06-20T14:00:00Z",
        }),
        event({
          kind: "cp_review_declined",
          occurred_at: "2026-06-21T09:00:00Z",
        }),
      ],
    });
    await renderPanel();
    expect(screen.getByText(/requested cp review/i)).toBeInTheDocument();
    expect(screen.getByText(/cp approved review/i)).toBeInTheDocument();
    expect(screen.getByText(/cp declined review/i)).toBeInTheDocument();
  });

  it("renders an error notice when the timeline fetch 401s", async () => {
    getFlightLogAuditTimeline.mockRejectedValueOnce(
      new TestApiError(401, "/x", "Unauthorized"),
    );
    await renderPanel();
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
  });

  it("renders the generic unavailable notice for other errors", async () => {
    getFlightLogAuditTimeline.mockRejectedValueOnce(
      new TestApiError(500, "/x", "Server Error"),
    );
    await renderPanel();
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });
});
