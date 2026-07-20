import Link from "next/link";

import { DocumentsFilterBar, DOCUMENT_CATEGORIES } from "./filter-bar";

/**
 * /documents — Document Library.
 *
 * Matches legacy peregrineflight.com/documents/:
 *   Breadcrumb: Home > Documents
 *   Header:     "Document Library" + subtitle "Company manuals,
 *               regulations, safety bulletins, and compliance references
 *               — N documents"  |  + Upload Document
 *   Filter:     Search (title, tags, filename) · Category dropdown ·
 *               Compliance sources only checkbox · Filter button
 *   Empty:      File glyph + "No documents yet. Upload your first
 *               document to get started." + Upload Document button
 *
 * There is no documents-service yet — Marc's HR/Documents M3 backend
 * story owns that. This page renders the shell so the home-tile can go
 * live, the URL stops 404-ing, and the layout is ready to wire up when
 * the API lands. Upload buttons render disabled with a milestone
 * tooltip until then; the filter bar's state is client-local (no
 * server round-trip) so search/category/compliance-only still respond
 * visually.
 */
export default function DocumentsPage() {
  const total: number = 0;
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

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Document Library</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Company manuals, regulations, safety bulletins, and compliance
            references — {total} document{total === 1 ? "" : "s"}
          </p>
        </div>
        <UploadButton />
      </header>

      <DocumentsFilterBar />

      <EmptyState />
    </div>
  );
}

/**
 * Legacy renders both Upload buttons in full-saturation blue — no
 * dimming — even though the flow needs a backend. We match that
 * exactly so the shell is visually indistinguishable, and rely on the
 * `disabled` attribute + `title` tooltip (rather than opacity) to
 * communicate the milestone gap. The header button prefixes with `+`;
 * the in-panel empty-state button does not (matches legacy).
 */
function UploadButton({ withPrefix = true }: { withPrefix?: boolean } = {}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Document uploads ship with the documents-service (M3 backend)"
      className="flex-shrink-0 cursor-not-allowed rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white opacity-100 disabled:opacity-100"
    >
      {withPrefix ? "+ Upload Document" : "Upload Document"}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 rounded-lg border border-border bg-card px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-8 w-8 text-muted-foreground/60"
          aria-hidden
        >
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">
        No documents yet. Upload your first document to get started.
      </p>
      <div className="mt-4 inline-flex">
        <UploadButton withPrefix={false} />
      </div>
    </div>
  );
}

export { DOCUMENT_CATEGORIES };
