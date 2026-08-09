import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  myRequiredReading,
  type RequiredReadingRow,
  type RequiredReadingResponse,
} from "@/lib/api/documents";

/**
 * /documents/ack — Required Reading queue.
 *
 * One entry per document flagged requires_acknowledgment=true. Split
 * into two sections:
 *   • Pending — the operator owes an ack on these
 *   • Acknowledged — receipt on file for the current version
 *
 * Clicking through goes to the doc detail page where the AckPanel is
 * the primary CTA. That indirection is deliberate — an ack should
 * be preceded by actually opening the file, and the detail page is
 * where the file lives.
 */
export const dynamic = "force-dynamic";

export default async function RequiredReadingPage() {
  let feed: RequiredReadingResponse = { items: [], pending: 0, total: 0 };
  let loadError: string | null = null;
  try {
    feed = await myRequiredReading();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Required-reading feed is unreachable. Try refreshing.";
  }

  const pending = feed.items.filter((r) => !r.status.acknowledged);
  const acknowledged = feed.items.filter((r) => r.status.acknowledged);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-xs">
        <Link
          href="/home"
          aria-label="Home"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          Home
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <Link
          href="/documents"
          className="text-muted-foreground hover:text-foreground"
        >
          Documents
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="font-semibold text-status-blue">Required Reading</span>
      </nav>

      <header className="mb-6 border-b border-border pb-4">
        <p className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
          Documents
        </p>
        <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">
          Required Reading
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {feed.total === 0
            ? "No documents in the required-reading queue right now."
            : `${feed.pending} pending · ${
                feed.total - feed.pending
              } acknowledged`}
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red"
        >
          {loadError}
        </div>
      )}

      {feed.total === 0 && !loadError && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-10 text-center text-sm text-muted-foreground">
          You&rsquo;re all caught up. When an admin flips a document into the
          required-reading queue, it&rsquo;ll show up here.
        </div>
      )}

      {pending.length > 0 && (
        <Section
          title="Pending"
          count={pending.length}
          tone="pending"
          rows={pending}
        />
      )}

      {acknowledged.length > 0 && (
        <Section
          title="Acknowledged"
          count={acknowledged.length}
          tone="acknowledged"
          rows={acknowledged}
        />
      )}
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  rows,
}: {
  title: string;
  count: number;
  tone: "pending" | "acknowledged";
  rows: RequiredReadingRow[];
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground/60">
          {count} document{count === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <RowCard key={row.document.id} row={row} tone={tone} />
        ))}
      </ul>
    </section>
  );
}

function RowCard({
  row,
  tone,
}: {
  row: RequiredReadingRow;
  tone: "pending" | "acknowledged";
}) {
  const doc = row.document;
  const status = row.status;
  const staleAck =
    tone === "pending" &&
    status.acknowledged_version_number !== null &&
    status.acknowledged_version_number < status.current_version_number;

  const badgeClass =
    tone === "acknowledged"
      ? "border-status-green/40 bg-status-green/10 text-status-green"
      : staleAck
        ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
        : "border-status-blue/40 bg-status-blue/10 text-status-blue";
  const badgeLabel =
    tone === "acknowledged"
      ? `Acked v${status.acknowledged_version_number ?? status.current_version_number}`
      : staleAck
        ? `Rev v${status.current_version_number} — re-ack`
        : "Ack required";

  return (
    <li className="rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/5">
      <Link
        href={`/documents/${doc.id}`}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-muted-foreground">
            {doc.category}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {doc.title}
          </div>
          {doc.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {doc.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
          <span
            className={`rounded border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${badgeClass}`}
          >
            {badgeLabel}
          </span>
          {tone === "acknowledged" && status.acknowledged_at && (
            <span className="text-[0.65rem] text-muted-foreground">
              {fmtDate(status.acknowledged_at)}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
