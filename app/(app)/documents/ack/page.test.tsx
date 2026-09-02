import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DocumentRow,
  MyAcknowledgmentStatus,
  RequiredReadingRow,
} from "@/lib/api/documents";

/**
 * /documents/ack — the required-reading queue.
 *
 * Three states, not two: never acknowledged, acknowledged against the
 * current revision, and acknowledged against a superseded one. That
 * third case is the whole point of the page — a receipt on file for v1
 * of a manual now at v3 is not compliance, and the queue has to say so
 * rather than showing a green tick.
 */

const { TestApiError, myRequiredReading } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, myRequiredReading: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/documents", () => ({ myRequiredReading }));

import RequiredReadingPage from "./page";

function row(
  docOver: Partial<DocumentRow> & { id: string },
  statusOver: Partial<MyAcknowledgmentStatus> = {},
): RequiredReadingRow {
  return {
    document: {
      title: "General Operations Manual",
      slug: "gom",
      category: "Company Manuals",
      description: null,
      is_archived: false,
      requires_acknowledgment: true,
      current_version_id: "v-1",
      current_version_number: 1,
      created_by_user_id: "u-1",
      created_by_name: "Alice Chen",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      ...docOver,
    },
    status: {
      document_id: docOver.id,
      current_version_id: "v-1",
      current_version_number: 1,
      requires_acknowledgment: true,
      acknowledged: false,
      acknowledged_at: null,
      acknowledged_version_number: null,
      ...statusOver,
    },
  } as RequiredReadingRow;
}

const renderPage = async () => render(await RequiredReadingPage());

const sectionNamed = (name: RegExp) =>
  screen.getByRole("heading", { level: 2, name }).closest("section")!;

beforeEach(() => {
  myRequiredReading.mockReset();
  myRequiredReading.mockResolvedValue({ items: [], pending: 0, total: 0 });
});

describe("splitting the queue", () => {
  it("puts unacknowledged documents under Pending and the rest under Acknowledged", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row({ id: "d-1", title: "Owed Manual" }, { acknowledged: false }),
        row(
          { id: "d-2", title: "Done Manual" },
          { acknowledged: true, acknowledged_at: "2026-08-10T00:00:00Z", acknowledged_version_number: 1 },
        ),
      ],
      pending: 1,
      total: 2,
    });
    await renderPage();
    expect(
      within(sectionNamed(/Pending/)).getByText("Owed Manual"),
    ).toBeInTheDocument();
    expect(
      within(sectionNamed(/Acknowledged/)).getByText("Done Manual"),
    ).toBeInTheDocument();
  });

  it("omits a section entirely when it would be empty", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [row({ id: "d-1" }, { acknowledged: false })],
      pending: 1,
      total: 1,
    });
    await renderPage();
    expect(screen.getByRole("heading", { level: 2, name: /Pending/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: /Acknowledged/ }),
    ).not.toBeInTheDocument();
  });

  it("counts each section's own documents, singular and plural", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row({ id: "d-1" }, { acknowledged: false }),
        row({ id: "d-2" }, { acknowledged: false }),
        row({ id: "d-3" }, { acknowledged: true, acknowledged_version_number: 1 }),
      ],
      pending: 2,
      total: 3,
    });
    await renderPage();
    // Read the count span itself and compare exactly. Matching against
    // the section's text does not work in either direction: "1 documents"
    // contains the substring "1 document", and a \b anchor is no help
    // because the section's text nodes run together ("1 documentGeneral
    // Operations Manual"), leaving no boundary to anchor to.
    const countIn = (section: HTMLElement) =>
      section.querySelector("h2 + span")?.textContent;
    expect(countIn(sectionNamed(/Pending/))).toBe("2 documents");
    expect(countIn(sectionNamed(/Acknowledged/))).toBe("1 document");
  });
});

describe("the stale-acknowledgment case", () => {
  it("marks a receipt against a superseded revision as needing a re-ack", async () => {
    // Acked v1, manual now at v3. The server has this in the pending
    // list; the page has to explain why rather than just saying "ack
    // required", which reads as never having read it at all.
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row(
          { id: "d-1", current_version_number: 3 },
          {
            acknowledged: false,
            acknowledged_version_number: 1,
            current_version_number: 3,
          },
        ),
      ],
      pending: 1,
      total: 1,
    });
    await renderPage();
    expect(screen.getByText("Rev v3 — re-ack")).toBeInTheDocument();
    expect(screen.queryByText("Ack required")).not.toBeInTheDocument();
  });

  it("says plainly when the document was never acknowledged at all", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row({ id: "d-1" }, { acknowledged: false, acknowledged_version_number: null }),
      ],
      pending: 1,
      total: 1,
    });
    await renderPage();
    expect(screen.getByText("Ack required")).toBeInTheDocument();
    expect(screen.queryByText(/re-ack/)).not.toBeInTheDocument();
  });

  it("does not call an ack stale when it matches the current revision", async () => {
    // Equal, not less than — acking v2 of a v2 document is current.
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row(
          { id: "d-1", current_version_number: 2 },
          {
            acknowledged: false,
            acknowledged_version_number: 2,
            current_version_number: 2,
          },
        ),
      ],
      pending: 1,
      total: 1,
    });
    await renderPage();
    expect(screen.getByText("Ack required")).toBeInTheDocument();
    expect(screen.queryByText(/re-ack/)).not.toBeInTheDocument();
  });

  it("never shows a re-ack badge in the Acknowledged section", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row(
          { id: "d-1", current_version_number: 3 },
          {
            acknowledged: true,
            acknowledged_version_number: 1,
            current_version_number: 3,
            acknowledged_at: "2026-08-10T00:00:00Z",
          },
        ),
      ],
      pending: 0,
      total: 1,
    });
    await renderPage();
    const badge = screen.getByText("Acked v1");
    expect(badge).toBeInTheDocument();
    expect(screen.queryByText(/re-ack/)).not.toBeInTheDocument();
    // The label alone does not prove it: the acknowledged branch is
    // checked first, so dropping the tone guard on staleAck leaves the
    // wording intact and only turns the badge amber. Colour is the
    // observable difference, so colour is what gets asserted.
    expect(badge.className).toMatch(/status-green/);
    expect(badge.className).not.toMatch(/status-yellow/);
  });

  it("falls back to the current version number when the acked one is missing", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row(
          { id: "d-1", current_version_number: 4 },
          {
            acknowledged: true,
            acknowledged_version_number: null,
            current_version_number: 4,
            acknowledged_at: "2026-08-10T00:00:00Z",
          },
        ),
      ],
      pending: 0,
      total: 1,
    });
    await renderPage();
    expect(screen.getByText("Acked v4")).toBeInTheDocument();
  });
});

describe("acknowledgment date", () => {
  it("shows the date on an acknowledged row", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row(
          { id: "d-1" },
          {
            acknowledged: true,
            acknowledged_version_number: 1,
            acknowledged_at: "2026-08-10T12:00:00Z",
          },
        ),
      ],
      pending: 0,
      total: 1,
    });
    await renderPage();
    // Rendered in the host zone and locale rather than UTC, so only the
    // presence of a date is asserted — see the note in the PR.
    expect(sectionNamed(/Acknowledged/)).toHaveTextContent(/2026/);
  });

  it("keeps the date out of the Pending section", async () => {
    // A stale re-ack row is pending and still has an acknowledged_at
    // from the earlier revision. Showing that date beside "re-ack"
    // would read as though the current revision had been acknowledged.
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row(
          { id: "d-1", current_version_number: 3 },
          {
            acknowledged: false,
            acknowledged_version_number: 1,
            current_version_number: 3,
            acknowledged_at: "2026-08-10T12:00:00Z",
          },
        ),
      ],
      pending: 1,
      total: 1,
    });
    await renderPage();
    expect(sectionNamed(/Pending/)).not.toHaveTextContent(/2026/);
  });

  it("omits the date when the receipt carries no timestamp", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [
        row(
          { id: "d-1" },
          { acknowledged: true, acknowledged_version_number: 1, acknowledged_at: null },
        ),
      ],
      pending: 0,
      total: 1,
    });
    await renderPage();
    expect(sectionNamed(/Acknowledged/)).not.toHaveTextContent(/\d{4}/);
  });
});

describe("header summary", () => {
  it("reports the split the server counted", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [row({ id: "d-1" }, { acknowledged: false })],
      pending: 2,
      total: 5,
    });
    await renderPage();
    expect(screen.getByText("2 pending · 3 acknowledged")).toBeInTheDocument();
  });

  it("says the queue is empty when it is", async () => {
    await renderPage();
    expect(
      screen.getByText(/No documents in the required-reading queue/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
});

describe("load failures", () => {
  it.each([
    [401, /session expired/i],
    [500, /unreachable/i],
  ])("explains a %i", async (status, msg) => {
    myRequiredReading.mockRejectedValueOnce(
      new TestApiError(status, "/documents/required-reading", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(msg);
  });

  it("treats a non-API failure as unreachable", async () => {
    myRequiredReading.mockRejectedValueOnce(new Error("ECONNRESET"));
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/unreachable/i);
  });

  it("does not claim the user is caught up when the feed failed", async () => {
    // The reassuring empty state and an error are contradictory; a
    // pilot reading "all caught up" after a failed load would think
    // they owe nothing.
    myRequiredReading.mockRejectedValueOnce(
      new TestApiError(500, "/documents/required-reading", "nope"),
    );
    await renderPage();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("links each row to the document, where the ack control lives", async () => {
    myRequiredReading.mockResolvedValueOnce({
      items: [row({ id: "d-42" }, { acknowledged: false })],
      pending: 1,
      total: 1,
    });
    await renderPage();
    expect(
      screen.getByRole("link", { name: /General Operations Manual/ }),
    ).toHaveAttribute("href", "/documents/d-42");
  });
});
