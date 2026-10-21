import Link from "next/link";

import { EmptyState } from "@/components/ff/empty-state";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { ApiError } from "@/lib/api/client";
import { listCpReviews } from "@/lib/api/ops";
import type { CpReviewResponse, CpReviewStatus } from "@/lib/api/types";

import { CpReviewDecideButtons } from "./decide-buttons";
import { CpReviewStatusFilter } from "./status-filter";

/**
 * /flight-crew/elog/cp-reviews — CP queue for the M2-M-10b
 * approval gate. Chief pilots see pending requests from pilots
 * for out-of-window reopen / delete on flight logs, approve or
 * decline with an optional note.
 *
 * Non-CP users see a 403 → friendly notice; the backend gates the
 * list endpoint by chief_pilot / exec_admin role.
 */

const ALLOWED_STATUSES: ReadonlySet<CpReviewStatus> = new Set([
  "pending",
  "approved",
  "declined",
]);

function parseStatus(raw: string | undefined): CpReviewStatus | undefined {
  if (!raw) return undefined;
  const lc = raw.toLowerCase() as CpReviewStatus;
  return ALLOWED_STATUSES.has(lc) ? lc : undefined;
}

export default async function CpReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = parseStatus(statusParam);

  let reviews: CpReviewResponse[] = [];
  let loadError: string | null = null;
  let notAuthorized = false;

  try {
    reviews = (await listCpReviews({ status: status ?? "pending" })).items;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        notAuthorized = true;
      } else if (err.status === 401) {
        loadError = "Your session expired — please sign in again.";
      } else {
        loadError = "CP review queue unavailable. Try refreshing in a moment.";
      }
    } else {
      loadError = "CP review queue unavailable. Try refreshing in a moment.";
    }
  }

  if (notAuthorized) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PageHeader title="CP Review Queue" />
        <p className="notice notice-yellow">
          Only chief pilots can review out-of-window flight log requests.
        </p>
      </div>
    );
  }

  const activeStatus: CpReviewStatus = status ?? "pending";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Flight Log Review Queue"
        description="Pilot requests for reopening or deleting flight logs past the 90-day window. Approving fires the action under your authority; the audit chain records you."
      />

      <CpReviewStatusFilter active={activeStatus} />

      {loadError ? (
        <div role="alert" className="notice notice-yellow">
          {loadError}
        </div>
      ) : reviews.length === 0 ? (
        <Panel flush>
          <EmptyState>
            {activeStatus === "pending"
              ? "No pending requests right now."
              : `No ${activeStatus} reviews on file.`}
          </EmptyState>
        </Panel>
      ) : (
        <ReviewTable reviews={reviews} pending={activeStatus === "pending"} />
      )}
    </div>
  );
}

function ReviewTable({
  reviews,
  pending,
}: {
  reviews: CpReviewResponse[];
  pending: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="ff-thead">
          <tr>
            <th className="px-3 py-2 text-left">Requested</th>
            <th className="px-3 py-2 text-left">Pilot</th>
            <th className="px-3 py-2 text-left">Log</th>
            <th className="px-3 py-2 text-left">Action</th>
            <th className="px-3 py-2 text-left">Reason</th>
            {!pending && (
              <th className="px-3 py-2 text-left">Reviewed</th>
            )}
            {pending && <th className="px-3 py-2 text-right">Decide</th>}
          </tr>
        </thead>
        <tbody>
          {reviews.map((r) => (
            <tr key={r.id} className="border-t border-border align-top transition-colors hover:bg-accent/40">
              <td className="px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
                {r.requested_at.slice(0, 10)}
              </td>
              <td className="px-3 py-2 font-semibold text-foreground">
                {r.requested_by.full_name}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/flight-crew/elog/${r.flight_log_id}`}
                  className="font-mono text-primary hover:underline"
                >
                  {r.log_number}
                </Link>
              </td>
              <td className="px-3 py-2">
                <ActionBadge action={r.requested_action} />
              </td>
              <td className="px-3 py-2 text-foreground">
                {r.requested_reason ? (
                  <span className="line-clamp-2">{r.requested_reason}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              {!pending && (
                <td className="px-3 py-2 text-[0.65rem] text-muted-foreground">
                  {r.reviewed_at?.slice(0, 10) ?? "—"}
                  {r.reviewed_by ? ` · ${r.reviewed_by.full_name}` : ""}
                  {r.reviewer_note ? (
                    <div className="text-foreground">
                      &ldquo;{r.reviewer_note}&rdquo;
                    </div>
                  ) : null}
                </td>
              )}
              {pending && (
                <td className="px-3 py-2">
                  <CpReviewDecideButtons
                    reviewId={r.id}
                    action={r.requested_action}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionBadge({
  action,
}: {
  action: CpReviewResponse["requested_action"];
}) {
  const tone = action === "reopen" ? "text-status-yellow" : "text-status-red";
  return <span className={`status-mark text-[0.6rem] ${tone}`}>{action}</span>;
}
