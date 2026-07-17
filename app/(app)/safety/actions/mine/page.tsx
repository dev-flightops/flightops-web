import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  CAPA_STATUS_LABELS,
  type CorrectiveAction,
  listMyCapas,
} from "@/lib/api/safety";

/**
 * /safety/actions/mine — the caller's assigned CAPAs. Anyone with a
 * valid session can hit this; no role gate. Sort is soonest-due-first.
 */
export default async function MyCapasPage() {
  let items: CorrectiveAction[] = [];
  let loadError: string | null = null;
  try {
    items = (await listMyCapas({ limit: 200 })).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Feed unavailable. Try refreshing in a moment.";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/safety" className="hover:text-foreground">
            ← Safety SMS
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          My Corrective Actions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CAPAs assigned to you. Log progress from the detail page — the
          Safety Officer sees your notes on the board.
        </p>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No corrective actions assigned to you.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => {
            const dueDate = new Date(c.due_date + "T00:00:00");
            const overdue = dueDate < today && c.status !== "closed";
            return (
              <li key={c.id}>
                <Link
                  href={`/safety/actions/${c.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-muted/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold">{c.title}</span>
                      {overdue ? (
                        <span className="rounded border border-status-red/40 bg-status-red/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-status-red">
                          Overdue
                        </span>
                      ) : null}
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      Due {dueDate.toLocaleDateString()} · Opened by{" "}
                      {c.opened_by.full_name}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {CAPA_STATUS_LABELS[c.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
