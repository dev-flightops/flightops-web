import Link from "next/link";

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
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 px-6 py-8 text-center">
          <h1 className="text-base font-bold tracking-tight text-status-yellow">
            CP Review Queue
          </h1>
          <p className="mt-2 text-sm text-foreground">
            Only chief pilots can review out-of-window flight log requests.
          </p>
        </div>
      </div>
    );
  }

  const activeStatus: CpReviewStatus = status ?? "pending";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Flight Log Review Queue
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Pilot requests for reopening or deleting flight logs past the
          90-day window. Approving fires the action under your authority;
          the audit chain records you.
        </p>
      </header>

      <CpReviewStatusFilter active={activeStatus} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {activeStatus === "pending"
            ? "No pending requests right now."
            : `No ${activeStatus} reviews on file.`}
        </div>
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
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
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
          {reviews.map((r, idx) => (
            <tr
              key={r.id}
              className={
                idx % 2 === 0
                  ? "border-t border-border/60"
                  : "border-t border-border/60 bg-card/40"
              }
            >
              <td className="px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
                {r.requested_at.slice(0, 10)}
              </td>
              <td className="px-3 py-2 font-semibold text-foreground">
                {r.requested_by.full_name}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/flight-crew/elog/${r.flight_log_id}`}
                  className="font-mono text-status-blue hover:underline"
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
  const tone =
    action === "reopen"
      ? "bg-status-yellow/15 text-status-yellow"
      : "bg-status-red/15 text-status-red";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] ${tone}`}
    >
      {action}
    </span>
  );
}
