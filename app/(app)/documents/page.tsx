import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  listDocuments,
  myRequiredReading,
  type DocumentRow,
} from "@/lib/api/documents";

import { DocumentsFilterBar, DOCUMENT_CATEGORIES } from "./filter-bar";
import { UploadDocumentDrawer } from "./upload-document-drawer";

/**
 * /documents — Document Library.
 *
 * Legacy peregrineflight.com/documents/ shape, backed by the shipped
 * documents-service:
 *
 *   Breadcrumb: Home > Documents
 *   Header:     "Document Library" + subtitle + doc count
 *               | [+ Upload Document] drawer
 *   Filter:     Search (client-only for now) + Category + Compliance-only
 *   List:       Grouped by category, one row per document, link to detail
 *   Empty:      File glyph + "No documents yet" + Upload CTA
 *
 * Data comes from `GET /documents?category=...`. Search is client-only
 * (URL captures the search string but we filter the returned list
 * in-process); the backend endpoint doesn't yet support search by
 * title / tags / filename, and pushing a full-text search there is
 * its own follow-up story.
 */
export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    compliance?: string;
  }>;
}) {
  const params = await searchParams;
  const categoryFilter = (params.category ?? "").trim();
  const search = (params.q ?? "").trim().toLowerCase();
  const complianceOnly = params.compliance === "true";

  let items: DocumentRow[] = [];
  let backendCategories: string[] = [];
  let loadError: string | null = null;
  // Pending-ack count for the "Required reading" pill in the header.
  // Fetched in parallel with the list; feed failure is non-fatal —
  // the pill just hides when we can't count.
  let requiredReadingPending = 0;
  let requiredReadingTotal = 0;
  try {
    const [listResp, feedResp] = await Promise.all([
      listDocuments({
        category: categoryFilter || undefined,
      }),
      myRequiredReading().catch(() => null),
    ]);
    items = listResp.items;
    backendCategories = listResp.categories;
    if (feedResp) {
      requiredReadingPending = feedResp.pending;
      requiredReadingTotal = feedResp.total;
    }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Document library unavailable. Try refreshing in a moment.";
  }

  // Client-side filters that the backend doesn't cover yet.
  const filtered = items.filter((d) => {
    if (
      complianceOnly &&
      !isComplianceCategory(d.category)
    ) {
      return false;
    }
    if (search) {
      const hay = `${d.title} ${d.category} ${d.description ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const grouped = groupByCategory(filtered);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-xs">
        <Link
          href="/home"
          aria-label="Home"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="font-semibold text-status-blue">Documents</span>
      </nav>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Document Library
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Company manuals, regulations, safety bulletins, and compliance
            references — {total} document{total === 1 ? "" : "s"}
            {backendCategories.length > 0 && (
              <span className="text-muted-foreground/70">
                {" "}
                · {backendCategories.length} categor
                {backendCategories.length === 1 ? "y" : "ies"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {requiredReadingTotal > 0 && (
            <Link
              href="/documents/ack"
              className={
                "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition " +
                (requiredReadingPending > 0
                  ? "border-status-blue/40 bg-status-blue/10 text-status-blue hover:bg-status-blue/20"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/10")
              }
            >
              Required reading
              {requiredReadingPending > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-status-blue px-1.5 text-[0.65rem] font-bold text-white">
                  {requiredReadingPending}
                </span>
              )}
            </Link>
          )}
          <UploadDocumentDrawer variant="primary" />
        </div>
      </header>

      <div className="mb-4">
        <DocumentsFilterBar
          initialSearch={search}
          initialCategory={categoryFilter}
          initialComplianceOnly={complianceOnly}
        />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasAnyDocuments={items.length > 0} />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, docs }) => (
            <CategorySection key={category} category={category} docs={docs} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  docs,
}: {
  category: string;
  docs: DocumentRow[];
}) {
  return (
    <section>
      <h2 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {category} · {docs.length}
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {docs.map((d) => (
          <li key={d.id}>
            <Link
              href={`/documents/${d.id}`}
              className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/5"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">
                  {d.title}
                </div>
                {d.description && (
                  <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted-foreground">
                    {d.description}
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-baseline gap-3 text-[0.7rem] text-muted-foreground">
                <span className="hidden font-mono sm:inline">
                  v{d.current_version_number}
                </span>
                <span className="hidden sm:inline">{fmtDate(d.updated_at)}</span>
                <span className="font-semibold text-status-blue">Open →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState({ hasAnyDocuments }: { hasAnyDocuments: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
      <FileGlyph />
      <p className="mt-3 text-sm font-medium text-foreground">
        {hasAnyDocuments
          ? "No documents match your filters."
          : "No documents yet. Upload your first document to get started."}
      </p>
      {!hasAnyDocuments && (
        <div className="mt-4">
          <UploadDocumentDrawer variant="secondary" />
        </div>
      )}
    </div>
  );
}

function FileGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="mx-auto h-10 w-10 text-muted-foreground"
      aria-hidden
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
    </svg>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function groupByCategory(
  docs: DocumentRow[],
): { category: string; docs: DocumentRow[] }[] {
  const by = new Map<string, DocumentRow[]>();
  for (const d of docs) {
    const list = by.get(d.category) ?? [];
    list.push(d);
    by.set(d.category, list);
  }
  return Array.from(by.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]) => ({
      category,
      docs: list.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

const COMPLIANCE_CATEGORIES: ReadonlySet<string> = new Set<string>([
  ...DOCUMENT_CATEGORIES.filter((c) => {
    const v = c.value;
    return v === "regulations" || v === "compliance";
  }).map((c) => c.label),
  // Also accept the short slugs an operator might have typed by hand.
  "regulations",
  "compliance",
]);

function isComplianceCategory(category: string): boolean {
  return COMPLIANCE_CATEGORIES.has(category);
}
