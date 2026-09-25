import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  listDocuments,
  myRequiredReading,
  type DocumentRow,
} from "@/lib/api/documents";

import { DocumentsFilterBar } from "./filter-bar";
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
 *               (Compliance-only filters on the per-document
 *               `is_compliance_source` flag, server-side. It used to
 *               approximate it from the category, which excluded the
 *               GOM — see migration 0096.)
 *   List:       Grouped by category, one row per document, link to detail
 *   Empty:      File glyph + "No documents yet" + Upload CTA
 *
 * Data comes from `GET /documents?category=...&compliance_only=...`.
 * Search is client-only
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
        complianceOnly: complianceOnly || undefined,
      }),
      myRequiredReading().catch(() => null),
    ]);
    items = listResp.items;
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

  // Search is the only filter still applied in-process; category and
  // compliance_only are both server-side.
  const filtered = items.filter((d) => {
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
        <span className="font-semibold text-primary">Documents</span>
      </nav>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Document Library
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Company manuals, regulations, safety bulletins, and compliance
            references — {total} document{total === 1 ? "" : "s"}
            {/* The category count has to describe the same set the
                document count does. It used listResp.categories, which
                reflects only the backend's `category` filter — so with
                "Compliance sources only" ticked on a library with no
                compliance documents the line read "0 documents · 2
                categories". Zero documents cannot occupy two
                categories. */}
            {grouped.length > 0 && (
              <span className="text-muted-foreground/70">
                {" "}
                · {grouped.length} categor
                {grouped.length === 1 ? "y" : "ies"}
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
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/10")
              }
            >
              Required reading
              {requiredReadingPending > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-bold text-white">
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
        <EmptyState
          filtersActive={Boolean(categoryFilter || search || complianceOnly)}
          complianceOnly={complianceOnly}
        />
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
                {d.is_compliance_source && (
                  <span className="mt-1 inline-block rounded bg-status-orange/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-orange">
                    Compliance Source
                  </span>
                )}
              </div>
              <div className="flex flex-shrink-0 items-baseline gap-3 text-[0.7rem] text-muted-foreground">
                <span className="hidden font-mono sm:inline">
                  v{d.current_version_number}
                </span>
                <span className="hidden sm:inline">{fmtDate(d.updated_at)}</span>
                <span className="font-semibold text-primary">Open →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Three different empty results, which need three different sentences.
 *
 * `compliance_only` is now a server-side filter, so an empty `items`
 * no longer means an empty library — it means whatever the operator
 * asked for returned nothing. Deciding the message by counting rows
 * would tell an operator with ten documents that they have none and
 * offer them an upload button, which is the wrong next step.
 *
 * The compliance case gets its own sentence because "no matches" does
 * not tell an operator what to do about it: the flag is set per
 * document, and nobody has set it yet.
 */
function EmptyState({
  filtersActive,
  complianceOnly,
}: {
  filtersActive: boolean;
  complianceOnly: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
      <FileGlyph />
      <p className="mt-3 text-sm font-medium text-foreground">
        {!filtersActive
          ? "No documents yet. Upload your first document to get started."
          : complianceOnly
            ? "No documents are marked as compliance sources."
            : "No documents match your filters."}
      </p>
      {filtersActive && complianceOnly && (
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
          A compliance source is set per document — open a document and
          mark it to have it show here and feed the compliance checks.
        </p>
      )}
      {!filtersActive && (
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

