import { ApiError } from "@/lib/api/client";
import { getFlightLogAuditTimeline } from "@/lib/api/ops";
import type {
  AuditTimelineEvent,
  AuditTimelineKind,
} from "@/lib/api/types";

/**
 * Spec 4 / M2-M-10c — collapsible "History" panel on the elog
 * detail page. Renders the unified audit + CP-review timeline.
 *
 * Server-fetched inside a <details> wrapper so the data only loads
 * when the pilot/CP actually expands it. (Closed-by-default keeps
 * the page header airy for the common "I'm working on this log,
 * not auditing it" path.)
 *
 * One row per timeline event with kind-specific tone tokens — green
 * for submit, yellow for reopen, red for delete, blue for CP review
 * activity. Notes (audit.reason / requested_reason / reviewer_note)
 * surface inline.
 */
export async function AuditTimelinePanel({ logId }: { logId: string }) {
  let events: AuditTimelineEvent[] = [];
  let loadError: string | null = null;
  try {
    events = (await getFlightLogAuditTimeline(logId)).items;
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Sign in to see the history."
        : "History unavailable. Refresh in a moment.";
  }

  return (
    <details className="mt-4 rounded-lg border border-border bg-card">
      <summary className="cursor-pointer list-none px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">
        <span className="select-none">
          History
          {!loadError && events.length > 0 && (
            <span className="ml-2 rounded-full bg-muted/40 px-1.5 py-0.5 font-mono text-foreground">
              {events.length}
            </span>
          )}
        </span>
      </summary>
      <div className="border-t border-border/40 px-4 py-3">
        {loadError ? (
          <p role="alert" className="text-xs text-muted-foreground">
            {loadError}
          </p>
        ) : events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No lifecycle events yet. Submit the log to start the chain.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {events.map((e, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs">
                <KindBadge kind={e.kind} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-foreground">
                      {KIND_LABELS[e.kind]}
                    </span>
                    <span className="text-[0.65rem] text-muted-foreground">
                      by {e.actor.full_name}
                    </span>
                    <span className="font-mono text-[0.65rem] text-muted-foreground">
                      {formatWhen(e.occurred_at)}
                    </span>
                  </div>
                  {e.note && (
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                      &ldquo;{e.note}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

const KIND_LABELS: Record<AuditTimelineKind, string> = {
  submit: "Submitted",
  reopen: "Reopened",
  delete: "Deleted",
  cp_review_requested: "Requested CP review",
  cp_review_approved: "CP approved review",
  cp_review_declined: "CP declined review",
};

function KindBadge({ kind }: { kind: AuditTimelineKind }) {
  const tone =
    kind === "submit"
      ? "bg-status-green/15 text-status-green"
      : kind === "reopen"
        ? "bg-status-yellow/15 text-status-yellow"
        : kind === "delete"
          ? "bg-status-red/15 text-status-red"
          : kind === "cp_review_approved"
            ? "bg-status-green/15 text-status-green"
            : kind === "cp_review_declined"
              ? "bg-status-yellow/15 text-status-yellow"
              : "bg-status-blue/15 text-status-blue";
  return (
    <span
      className={`mt-0.5 inline-block w-[0.5rem] shrink-0 rounded-full ${tone}`}
      style={{ height: "0.5rem" }}
      aria-hidden="true"
    />
  );
}

function formatWhen(iso: string): string {
  // YYYY-MM-DD HH:MM (UTC slice — pilot/CP cares about the date +
  // time-of-day, not the full ISO).
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}Z`;
}
