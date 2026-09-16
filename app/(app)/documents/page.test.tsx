import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentRow } from "@/lib/api/documents";

/**
 * /documents — the Document Library.
 *
 * Two filters run in different places: category and compliance-only are
 * backend queries, search is applied in-process because the endpoint
 * does not support it yet. That split is the main thing worth pinning —
 * a filter silently moving to the wrong side changes which documents a
 * crew member is shown.
 *
 * Compliance-only used to run in-process, deciding from the category
 * whether a document was a compliance source. It excluded the GOM. It
 * now filters on the per-document `is_compliance_source` flag in the
 * backend, so what is pinned here is that the page ASKS for that and
 * does not second-guess the answer.
 */

const { TestApiError, listDocuments, myRequiredReading } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    listDocuments: vi.fn(),
    myRequiredReading: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/documents", () => ({ listDocuments, myRequiredReading }));
// useActionState drawer. filter-bar is left real — it has no imports,
// and it renders the checkbox whose state the page reads back.
vi.mock("./upload-document-drawer", () => ({
  UploadDocumentDrawer: ({ variant }: { variant: string }) => (
    <div data-testid="upload-drawer" data-variant={variant} />
  ),
}));

import DocumentsPage from "./page";

function doc(over: Partial<DocumentRow> & { id: string }): DocumentRow {
  return {
    title: "General Operations Manual",
    slug: "gom",
    category: "Company Manuals (GOM, OPM)",
    description: null,
    is_archived: false,
    requires_acknowledgment: false,
    is_compliance_source: false,
    current_version_id: "v-1",
    current_version_number: 3,
    created_by_user_id: "u-1",
    created_by_name: "Alice Chen",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-15T12:00:00Z",
    ...over,
  } as DocumentRow;
}

async function renderPage(
  searchParams: { category?: string; q?: string; compliance?: string } = {},
) {
  const ui = await DocumentsPage({ searchParams: Promise.resolve(searchParams) });
  return render(ui);
}

const titles = () =>
  screen.getAllByRole("link", { name: /Open →/ }).map((a) =>
    a.querySelector(".truncate")?.textContent,
  );

beforeEach(() => {
  listDocuments.mockReset();
  myRequiredReading.mockReset();
  listDocuments.mockResolvedValue({ items: [], categories: [] });
  myRequiredReading.mockResolvedValue({ pending: 0, total: 0 });
});

describe("category filter goes to the backend", () => {
  it("sends a chosen category as a query", async () => {
    await renderPage({ category: "manuals" });
    expect(listDocuments).toHaveBeenCalledWith({
      category: "manuals",
      complianceOnly: undefined,
    });
  });

  it("sends undefined rather than an empty string when unset", async () => {
    // An empty `category=` would filter to documents whose category is
    // literally "", which is every document in no category — not "all".
    await renderPage();
    expect(listDocuments).toHaveBeenCalledWith({
      category: undefined,
      complianceOnly: undefined,
    });
  });

  it("ignores surrounding whitespace in the param", async () => {
    await renderPage({ category: "  manuals  " });
    expect(listDocuments).toHaveBeenCalledWith({
      category: "manuals",
      complianceOnly: undefined,
    });
  });
});

describe("search filters in-process", () => {
  beforeEach(() => {
    listDocuments.mockResolvedValue({
      items: [
        doc({ id: "d-1", title: "General Operations Manual" }),
        doc({ id: "d-2", title: "Winter Ops Bulletin", category: "Safety Bulletins" }),
        doc({
          id: "d-3",
          title: "Hazmat Reference",
          category: "Compliance References",
          description: "Carriage of dangerous goods",
        }),
      ],
      categories: ["Company Manuals (GOM, OPM)"],
    });
  });

  it("never sends the search term to the backend", async () => {
    // The endpoint does not support it; forwarding it would be ignored
    // server-side and silently return unfiltered results.
    await renderPage({ q: "hazmat" });
    expect(listDocuments).toHaveBeenCalledWith({ category: undefined });
  });

  it("matches on title regardless of case", async () => {
    await renderPage({ q: "WINTER" });
    expect(titles()).toEqual(["Winter Ops Bulletin"]);
  });

  it("matches on description as well as title", async () => {
    await renderPage({ q: "dangerous goods" });
    expect(titles()).toEqual(["Hazmat Reference"]);
  });

  it("matches on category name", async () => {
    await renderPage({ q: "safety bulletins" });
    expect(titles()).toEqual(["Winter Ops Bulletin"]);
  });

  it("tolerates a document with no description", async () => {
    // `null` description concatenated raw would search the string
    // "null" and match a document titled e.g. "Null Island Ops".
    await renderPage({ q: "null" });
    expect(screen.getByText(/No documents match your filters/i)).toBeInTheDocument();
  });
});

describe("compliance-only filter goes to the backend", () => {
  it("asks the backend for compliance sources when ticked", async () => {
    await renderPage({ compliance: "true" });
    expect(listDocuments).toHaveBeenCalledWith({
      category: undefined,
      complianceOnly: true,
    });
  });

  it("treats any value other than the literal true as off", async () => {
    await renderPage({ compliance: "1" });
    expect(listDocuments).toHaveBeenCalledWith({
      category: undefined,
      complianceOnly: undefined,
    });
  });

  it("does not re-filter the rows the backend already narrowed", async () => {
    // The bug this replaces: the page decided for itself which
    // categories counted as compliance sources, and dropped a GOM the
    // operator had explicitly designated. Whatever comes back for
    // compliance_only=true is the answer.
    listDocuments.mockResolvedValueOnce({
      items: [
        doc({
          id: "d-1",
          title: "General Operations Manual",
          category: "Company Manuals (GOM, OPM)",
          is_compliance_source: true,
        }),
      ],
      categories: ["Company Manuals (GOM, OPM)"],
    });
    await renderPage({ compliance: "true" });
    expect(titles()).toEqual(["General Operations Manual"]);
  });

  it("keeps the checkbox ticked so the filter is visibly on", async () => {
    await renderPage({ compliance: "true" });
    expect(
      screen.getByRole("checkbox", { name: /Compliance sources only/i }),
    ).toBeChecked();
  });

  it("leaves the checkbox clear when the filter is off", async () => {
    await renderPage();
    expect(
      screen.getByRole("checkbox", { name: /Compliance sources only/i }),
    ).not.toBeChecked();
  });

  it("badges a designated document in the list", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [
        doc({ id: "d-1", title: "GOM", is_compliance_source: true }),
        doc({ id: "d-2", title: "Holiday Schedule" }),
      ],
      categories: ["Company Manuals (GOM, OPM)"],
    });
    await renderPage();
    // One badge, on the designated document only — a badge on every
    // row would make the label meaningless.
    expect(screen.getAllByText("Compliance Source")).toHaveLength(1);
  });
});

describe("nothing matches the compliance filter", () => {
  it("says no documents are marked rather than that there are none", async () => {
    // `compliance_only` is a backend filter now, so an empty result is
    // not an empty library. Telling an operator with ten documents
    // that they have none, and offering an upload button, sends them
    // to the wrong place.
    await renderPage({ compliance: "true" });
    expect(
      screen.getByText(/No documents are marked as compliance sources/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No documents yet/i)).not.toBeInTheDocument();
  });

  it("says how a document gets marked", async () => {
    await renderPage({ compliance: "true" });
    expect(screen.getByText(/set per document/i)).toBeInTheDocument();
  });

  it("does not offer the upload CTA", async () => {
    await renderPage({ compliance: "true" });
    expect(screen.getAllByTestId("upload-drawer")).toHaveLength(1);
  });

  it("still says match-your-filters for a plain search miss", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [doc({ id: "d-1" })],
      categories: ["Company Manuals (GOM, OPM)"],
    });
    await renderPage({ q: "zzz" });
    expect(
      screen.getByText(/No documents match your filters/i),
    ).toBeInTheDocument();
  });
});

describe("required reading pill", () => {
  it("stays hidden when nothing is assigned", async () => {
    myRequiredReading.mockResolvedValueOnce({ pending: 0, total: 0 });
    await renderPage();
    expect(
      screen.queryByRole("link", { name: /Required reading/ }),
    ).not.toBeInTheDocument();
  });

  it("appears without a count once everything is acknowledged", async () => {
    myRequiredReading.mockResolvedValueOnce({ pending: 0, total: 4 });
    await renderPage();
    const pill = screen.getByRole("link", { name: /Required reading/ });
    expect(pill).toHaveAttribute("href", "/documents/ack");
    expect(pill).not.toHaveTextContent(/\d/);
  });

  it("carries the outstanding count when there is one", async () => {
    myRequiredReading.mockResolvedValueOnce({ pending: 2, total: 4 });
    await renderPage();
    expect(
      screen.getByRole("link", { name: /Required reading/ }),
    ).toHaveTextContent("2");
  });

  it("hides the pill rather than failing the page when the feed errors", async () => {
    // The count is a convenience; the library still has to render.
    myRequiredReading.mockRejectedValueOnce(
      new TestApiError(500, "/documents/required-reading", "nope"),
    );
    listDocuments.mockResolvedValueOnce({
      items: [doc({ id: "d-1" })],
      categories: [],
    });
    await renderPage();
    expect(
      screen.queryByRole("link", { name: /Required reading/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(titles()).toEqual(["General Operations Manual"]);
  });
});

describe("grouping", () => {
  it("orders categories alphabetically and titles within them", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [
        doc({ id: "d-1", title: "Zulu Manual", category: "Manuals" }),
        doc({ id: "d-2", title: "Alpha Bulletin", category: "Bulletins" }),
        doc({ id: "d-3", title: "Alpha Manual", category: "Manuals" }),
      ],
      categories: [],
    });
    await renderPage();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Bulletins · 1", "Manuals · 2"]);
    expect(titles()).toEqual(["Alpha Bulletin", "Alpha Manual", "Zulu Manual"]);
  });

  it("counts each category's own documents", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [
        doc({ id: "d-1", category: "Manuals", title: "A" }),
        doc({ id: "d-2", category: "Manuals", title: "B" }),
        doc({ id: "d-3", category: "Bulletins", title: "C" }),
      ],
      categories: [],
    });
    await renderPage();
    const manuals = screen.getByRole("heading", { level: 2, name: /Manuals/ });
    expect(manuals).toHaveTextContent("Manuals · 2");
  });
});

describe("rows", () => {
  it("links each document to its detail page and shows its version", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [doc({ id: "d-42", current_version_number: 7 })],
      categories: [],
    });
    await renderPage();
    const link = screen.getByRole("link", { name: /Open →/ });
    expect(link).toHaveAttribute("href", "/documents/d-42");
    expect(within(link).getByText("v7")).toBeInTheDocument();
  });

  it("renders the updated date in UTC regardless of host zone", async () => {
    // The timestamps have to sit near the UTC day boundary or this
    // proves nothing: a midday UTC instant lands on the same calendar
    // day in every zone, so the assertion would pass with the UTC
    // formatter removed. 23:00Z rolls forward in Tokyo, 02:00Z rolls
    // back in Anchorage — each catches one direction.
    const cases = [
      ["Asia/Tokyo", "2026-08-15T23:00:00Z"],
      ["America/Anchorage", "2026-08-15T02:00:00Z"],
    ] as const;
    for (const [tz, updatedAt] of cases) {
      process.env.TZ = tz;
      listDocuments.mockResolvedValueOnce({
        items: [doc({ id: "d-1", updated_at: updatedAt })],
        categories: [],
      });
      const { unmount } = await renderPage();
      expect(
        screen.getByText("Aug 15, 2026"),
        `updated date shifted under TZ=${tz}`,
      ).toBeInTheDocument();
      unmount();
    }
    process.env.TZ = "UTC";
  });

  it("dashes an unparseable timestamp instead of printing Invalid Date", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [doc({ id: "d-1", updated_at: "not-a-date" })],
      categories: [],
    });
    await renderPage();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});

describe("empty and error states", () => {
  it("distinguishes an empty library from an over-filtered one", async () => {
    const { unmount } = await renderPage();
    expect(screen.getByText(/No documents yet/i)).toBeInTheDocument();
    unmount();

    listDocuments.mockResolvedValueOnce({
      items: [doc({ id: "d-1", title: "General Operations Manual" })],
      categories: [],
    });
    await renderPage({ q: "nothing matches this" });
    expect(screen.getByText(/No documents match your filters/i)).toBeInTheDocument();
  });

  it("offers the upload CTA only when the library is genuinely empty", async () => {
    // Prompting "upload your first document" to someone who has simply
    // typed a narrow search is the wrong instruction.
    const { unmount } = await renderPage();
    expect(screen.getAllByTestId("upload-drawer")).toHaveLength(2);
    unmount();

    listDocuments.mockResolvedValueOnce({
      items: [doc({ id: "d-1", title: "General Operations Manual" })],
      categories: [],
    });
    await renderPage({ q: "zzz" });
    expect(screen.getAllByTestId("upload-drawer")).toHaveLength(1);
  });

  it.each([
    [401, /session expired/i],
    [500, /unavailable/i],
  ])("explains a %i without claiming the library is empty", async (status, msg) => {
    listDocuments.mockRejectedValueOnce(
      new TestApiError(status, "/documents", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(msg);
    expect(screen.queryByText(/No documents yet/i)).not.toBeInTheDocument();
  });
});

describe("header counts", () => {
  it("counts what is shown, not what was fetched", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [
        doc({ id: "d-1", title: "Keep Me" }),
        doc({ id: "d-2", title: "Filter Me Out" }),
      ],
      categories: [],
    });
    await renderPage({ q: "keep" });
    expect(screen.getByText(/1 document(?!s)/)).toBeInTheDocument();
  });

  it("pluralises documents and categories", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [
        doc({ id: "d-1", category: "Company Manuals (GOM, OPM)" }),
        doc({ id: "d-2", title: "Second", category: "Safety Bulletins" }),
      ],
      categories: ["Company Manuals (GOM, OPM)", "Safety Bulletins"],
    });
    await renderPage();
    expect(screen.getByText(/2 documents/)).toBeInTheDocument();
    expect(screen.getByText(/2 categories/)).toBeInTheDocument();
  });

  it("uses the singular category form for one", async () => {
    listDocuments.mockResolvedValueOnce({
      items: [doc({ id: "d-1" })],
      categories: ["a"],
    });
    await renderPage();
    expect(screen.getByText(/1 category/)).toBeInTheDocument();
  });

  it("counts the categories on screen, not the tenant's whole taxonomy", async () => {
    // The reported bug. `categories` from the backend is deliberately
    // the tenant's full list — it populates the picker, and stays
    // stable as filters narrow. Reading the header count off it put
    // two halves of one sentence on different sets, so ticking
    // compliance-only on a library with none produced
    // "0 documents · 2 categories". Zero documents cannot occupy two
    // categories.
    listDocuments.mockResolvedValueOnce({
      items: [
        doc({ id: "d-1", title: "Keep Me", category: "Safety Bulletins" }),
        doc({
          id: "d-2",
          title: "Filter Me Out",
          category: "Company Manuals (GOM, OPM)",
        }),
      ],
      categories: ["Company Manuals (GOM, OPM)", "Safety Bulletins"],
    });
    await renderPage({ q: "keep" });
    expect(screen.getByText(/1 document(?!s)/)).toBeInTheDocument();
    expect(screen.getByText(/1 category(?!\w)/)).toBeInTheDocument();
    expect(screen.queryByText(/2 categories/)).not.toBeInTheDocument();
  });

  it("drops the category clause entirely when nothing is shown", async () => {
    // Rather than "0 documents · 0 categories", which reads like a
    // broken counter next to an empty-state message that already
    // explains itself.
    listDocuments.mockResolvedValueOnce({
      items: [doc({ id: "d-1" })],
      categories: ["Company Manuals (GOM, OPM)"],
    });
    await renderPage({ q: "zzz" });
    expect(screen.getByText(/0 documents/)).toBeInTheDocument();
    expect(screen.queryByText(/categor/)).not.toBeInTheDocument();
  });
});
