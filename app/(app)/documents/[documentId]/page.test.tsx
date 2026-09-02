import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentRow, DocumentVersion } from "@/lib/api/documents";

/**
 * /documents/[documentId] — document detail and version history.
 *
 * A controlled manual's version history is a compliance record: which
 * revision is current, who uploaded it and when. Showing the wrong
 * revision as current is the failure that matters here, so the ordering
 * and the "Current" marker are pinned hardest.
 */

const {
  TestApiError,
  getDocument,
  myAcknowledgment,
  downloadUrl,
  versionDownloadUrl,
  notFound,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  class NotFoundSignal extends Error {}
  return {
    TestApiError,
    NotFoundSignal,
    getDocument: vi.fn(),
    myAcknowledgment: vi.fn(),
    downloadUrl: vi.fn((id: string) => `/api/documents/${id}/download`),
    versionDownloadUrl: vi.fn(
      (id: string, n: number) => `/api/documents/${id}/versions/${n}/download`,
    ),
    // Next's notFound() throws to unwind the render. Throwing a tagged
    // error here keeps that behaviour observable without pulling in
    // next/navigation's real internals.
    notFound: vi.fn(() => {
      throw new NotFoundSignal("NEXT_NOT_FOUND");
    }),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/api/documents", () => ({
  getDocument,
  myAcknowledgment,
  downloadUrl,
  versionDownloadUrl,
}));
vi.mock("./ack-panel", () => ({
  AckPanel: (props: {
    documentId: string;
    currentVersionNumber: number;
    initialAcknowledged: boolean;
    initialAcknowledgedVersionNumber: number | null;
  }) => (
    <div
      data-testid="ack-panel"
      data-doc-id={props.documentId}
      data-current-version={props.currentVersionNumber}
      data-acknowledged={String(props.initialAcknowledged)}
      data-acked-version={String(props.initialAcknowledgedVersionNumber)}
    />
  ),
}));
vi.mock("./upload-version-drawer", () => ({
  UploadVersionDrawer: ({ documentId }: { documentId: string }) => (
    <div data-testid="upload-version" data-doc-id={documentId} />
  ),
}));

import DocumentDetailPage from "./page";

function version(
  over: Partial<DocumentVersion> & { id: string; version_number: number },
): DocumentVersion {
  return {
    file_key: `key-${over.version_number}`,
    original_filename: "gom.pdf",
    content_type: "application/pdf",
    size_bytes: 2048,
    notes: null,
    uploaded_by_user_id: "u-1",
    uploaded_by_name: "Alice Chen",
    uploaded_at: "2026-08-15T12:00:00Z",
    ...over,
  } as DocumentVersion;
}

function documentRow(over: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "d-1",
    title: "General Operations Manual",
    slug: "gom",
    category: "Company Manuals",
    description: null,
    is_archived: false,
    requires_acknowledgment: false,
    current_version_id: "v-2",
    current_version_number: 2,
    created_by_user_id: "u-1",
    created_by_name: "Alice Chen",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-15T12:00:00Z",
    ...over,
  } as DocumentRow;
}

async function renderPage(documentId = "d-1") {
  const ui = await DocumentDetailPage({ params: Promise.resolve({ documentId }) });
  return render(ui);
}

beforeEach(() => {
  getDocument.mockReset();
  myAcknowledgment.mockReset();
  notFound.mockClear();
  getDocument.mockResolvedValue({
    document: documentRow(),
    versions: [version({ id: "v-1", version_number: 1 }), version({ id: "v-2", version_number: 2 })],
  });
});

describe("loading", () => {
  it("requests the document named in the route", async () => {
    await renderPage("d-42");
    expect(getDocument).toHaveBeenCalledWith("d-42");
  });

  it("renders the 404 page when the document does not exist", async () => {
    getDocument.mockRejectedValueOnce(
      new TestApiError(404, "/documents/d-1", "gone"),
    );
    await expect(renderPage()).rejects.toThrow(/NEXT_NOT_FOUND/);
    expect(notFound).toHaveBeenCalled();
  });

  it("lets any other failure surface rather than showing an empty document", async () => {
    // A 500 rendered as "not found" would tell a pilot the manual has
    // been withdrawn when the service is merely down.
    getDocument.mockRejectedValueOnce(
      new TestApiError(500, "/documents/d-1", "boom"),
    );
    await expect(renderPage()).rejects.toThrow("boom");
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("acknowledgment panel", () => {
  it("is not fetched at all for a document that needs no ack", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ requires_acknowledgment: false }),
      versions: [],
    });
    await renderPage();
    expect(myAcknowledgment).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ack-panel")).not.toBeInTheDocument();
  });

  it("is fetched and rendered when the document requires one", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ requires_acknowledgment: true }),
      versions: [],
    });
    myAcknowledgment.mockResolvedValueOnce({
      document_id: "d-1",
      current_version_id: "v-2",
      current_version_number: 2,
      requires_acknowledgment: true,
      acknowledged: true,
      acknowledged_at: "2026-08-16T00:00:00Z",
      acknowledged_version_number: 1,
    });
    await renderPage();
    expect(myAcknowledgment).toHaveBeenCalledWith("d-1");
    const panel = screen.getByTestId("ack-panel");
    expect(panel).toHaveAttribute("data-current-version", "2");
    // Acknowledged v1 while v2 is current — the panel needs both numbers
    // to tell the reader their acknowledgment is stale.
    expect(panel).toHaveAttribute("data-acked-version", "1");
  });

  it("hides the panel rather than failing the page when the ack call errors", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ requires_acknowledgment: true }),
      versions: [version({ id: "v-2", version_number: 2 })],
    });
    myAcknowledgment.mockRejectedValueOnce(new Error("nope"));
    await renderPage();
    expect(screen.queryByTestId("ack-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Version History/ })).toBeInTheDocument();
  });
});

describe("version history", () => {
  it("lists newest first regardless of the order the API returned", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ current_version_id: "v-1", current_version_number: 1 }),
      versions: [
        version({ id: "v-1", version_number: 1 }),
        version({ id: "v-3", version_number: 3 }),
        version({ id: "v-2", version_number: 2 }),
      ],
    });
    await renderPage();
    const rows = screen.getAllByRole("row").slice(1); // drop the header
    expect(rows.map((r) => within(r).getByText(/^v\d+$/).textContent)).toEqual([
      "v3",
      "v2",
      "v1",
    ]);
  });

  it("marks the current version and only that one", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ current_version_id: "v-2", current_version_number: 2 }),
      versions: [
        version({ id: "v-1", version_number: 1 }),
        version({ id: "v-2", version_number: 2 }),
        version({ id: "v-3", version_number: 3 }),
      ],
    });
    await renderPage();
    const current = screen.getAllByText("Current");
    expect(current).toHaveLength(1);
    // v2 is current even though v3 exists — a newer upload is not
    // automatically the controlled revision.
    const row = current[0].closest("tr")!;
    expect(within(row).getByText("v2")).toBeInTheDocument();
  });

  it("marks nothing when the document has no current version", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ current_version_id: null, current_version_number: 0 }),
      versions: [version({ id: "v-1", version_number: 1 })],
    });
    await renderPage();
    expect(screen.queryByText("Current")).not.toBeInTheDocument();
  });

  it("links each row to that row's own version download", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow(),
      versions: [
        version({ id: "v-1", version_number: 1 }),
        version({ id: "v-2", version_number: 2 }),
      ],
    });
    await renderPage();
    const links = screen.getAllByRole("link", { name: /Download$/ });
    expect(links[0]).toHaveAttribute(
      "href",
      "/api/documents/d-1/versions/2/download",
    );
    expect(links[1]).toHaveAttribute(
      "href",
      "/api/documents/d-1/versions/1/download",
    );
  });

  it("says so plainly when nothing has been uploaded", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ current_version_id: null, current_version_number: 0 }),
      versions: [],
    });
    await renderPage();
    expect(screen.getByText(/No versions uploaded yet/i)).toBeInTheDocument();
  });

  it("counts versions, singular and plural", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow(),
      versions: [version({ id: "v-1", version_number: 1 })],
    });
    const { unmount } = await renderPage();
    expect(screen.getByText(/1 version ·/)).toBeInTheDocument();
    unmount();

    getDocument.mockResolvedValueOnce({
      document: documentRow(),
      versions: [
        version({ id: "v-1", version_number: 1 }),
        version({ id: "v-2", version_number: 2 }),
      ],
    });
    await renderPage();
    expect(screen.getByText(/2 versions ·/)).toBeInTheDocument();
  });

  it("dashes an uploader the API could not name", async () => {
    // notes carries a value on purpose: it also dashes when empty, so a
    // row with both blank cannot tell the two apart and the assertion
    // would survive the uploader dash being removed.
    getDocument.mockResolvedValueOnce({
      document: documentRow(),
      versions: [
        version({
          id: "v-1",
          version_number: 1,
          uploaded_by_name: null,
          notes: "Initial upload",
        }),
      ],
    });
    await renderPage();
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getAllByText("—")).toHaveLength(1);
  });

  it("dashes an empty notes cell", async () => {
    // Same isolation the other way round: the uploader is named, so the
    // only dash that can appear is the notes one.
    getDocument.mockResolvedValueOnce({
      document: documentRow(),
      versions: [
        version({
          id: "v-1",
          version_number: 1,
          uploaded_by_name: "Alice Chen",
          notes: null,
        }),
      ],
    });
    await renderPage();
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getAllByText("—")).toHaveLength(1);
  });
});

describe("file size", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1023, "1023 B"],
    [1024, "1.0 KB"],
    [1536, "1.5 KB"],
    [1048575, "1024.0 KB"],
    [1048576, "1.0 MB"],
    [5242880, "5.0 MB"],
  ])("renders %i bytes as %s", async (bytes, expected) => {
    getDocument.mockResolvedValueOnce({
      document: documentRow(),
      versions: [version({ id: "v-1", version_number: 1, size_bytes: bytes })],
    });
    await renderPage();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe("timestamps", () => {
  it("renders upload times in UTC and says so, in any host zone", async () => {
    // 23:00Z rolls into the next day in Tokyo, 02:00Z into the previous
    // one in Anchorage. A midday instant would prove nothing.
    const cases = [
      ["Asia/Tokyo", "2026-08-15T23:00:00Z", "Aug 15, 2026, 23:00 UTC"],
      ["America/Anchorage", "2026-08-15T02:00:00Z", "Aug 15, 2026, 02:00 UTC"],
    ] as const;
    for (const [tz, uploadedAt, expected] of cases) {
      process.env.TZ = tz;
      getDocument.mockResolvedValueOnce({
        document: documentRow(),
        versions: [version({ id: "v-1", version_number: 1, uploaded_at: uploadedAt })],
      });
      const { unmount } = await renderPage();
      expect(
        screen.getByText(expected),
        `upload time shifted under TZ=${tz}`,
      ).toBeInTheDocument();
      unmount();
    }
    process.env.TZ = "UTC";
  });

  it("dashes an unparseable timestamp instead of printing Invalid Date", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ updated_at: "not-a-date" }),
      versions: [],
    });
    await renderPage();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("header", () => {
  it("offers the current-version download only when there is one", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ current_version_id: "v-2", current_version_number: 2 }),
      versions: [version({ id: "v-2", version_number: 2 })],
    });
    const { unmount } = await renderPage();
    expect(
      screen.getByRole("link", { name: /Download current \(v2\)/ }),
    ).toHaveAttribute("href", "/api/documents/d-1/download");
    unmount();

    getDocument.mockResolvedValueOnce({
      document: documentRow({ current_version_id: null, current_version_number: 0 }),
      versions: [],
    });
    await renderPage();
    expect(
      screen.queryByRole("link", { name: /Download current/ }),
    ).not.toBeInTheDocument();
  });

  it("withholds the download when the pointer names a version that is gone", async () => {
    // current_version_id set but absent from the list — linking anyway
    // produces a download that 404s.
    getDocument.mockResolvedValueOnce({
      document: documentRow({ current_version_id: "v-9", current_version_number: 9 }),
      versions: [version({ id: "v-1", version_number: 1 })],
    });
    await renderPage();
    expect(
      screen.queryByRole("link", { name: /Download current/ }),
    ).not.toBeInTheDocument();
  });

  it("flags an archived document", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ is_archived: true }),
      versions: [],
    });
    const { unmount } = await renderPage();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    unmount();

    await renderPage();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("shows a dash for the current version when there is none", async () => {
    getDocument.mockResolvedValueOnce({
      document: documentRow({ current_version_number: 0 }),
      versions: [],
    });
    await renderPage();
    expect(screen.getByText("Current version").previousSibling).toHaveTextContent("—");
  });
});
