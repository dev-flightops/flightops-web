import Link from "next/link";

import {
  CAPA_SOURCE_LABELS,
  CAPA_STATUS_LABELS,
  type CapaSourceType,
  type CorrectiveAction,
} from "@/lib/api/safety";

/**
 * CAPA panel embedded on the hazard, incident and safety report pages. Shows the
 * linked CAPAs (soonest due first) and a link to open a new one when
 * the caller has the manage role.
 *
 * Kept in components/safety/ rather than app/(app)/safety/[id]/ so
 * both the hazard and incident detail pages can import it — matches
 * the wider repo pattern of putting cross-page components in
 * components/*.
 */
export function CorrectiveActionPanel({
  sourceType,
  sourceId,
  items,
  canOpen,
}: {
  sourceType: CapaSourceType;
  sourceId: string;
  items: CorrectiveAction[];
  canOpen: boolean;
}) {
  const openHref = `/safety/actions/open?source_type=${sourceType}&source_id=${sourceId}`;
  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="eyebrow">
          Corrective Actions
        </h2>
        {canOpen ? (
          <Link
            href={openHref}
            className="btn-caps rounded-md border border-input px-2 py-1 text-foreground hover:border-foreground text-[0.68rem]"
          >
            + Open a CAPA
          </Link>
        ) : null}
      </header>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No corrective actions linked to this {CAPA_SOURCE_LABELS[sourceType].toLowerCase()} yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/safety/actions/${c.id}`}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{c.title}</span>
                    <DueChip due={c.due_date} status={c.status} />
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    Owner: {c.owner.full_name} · Due{" "}
                    {new Date(c.due_date).toLocaleDateString()}
                  </p>
                </div>
                <span className="whitespace-nowrap eyebrow">
                  {CAPA_STATUS_LABELS[c.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DueChip({
  due,
  status,
}: {
  due: string;
  status: CorrectiveAction["status"];
}) {
  if (status === "closed") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due + "T00:00:00");
  const overdue = dueDate < today;
  if (!overdue) return null;
  return (
    <span className="status-mark text-status-red">
      Overdue
    </span>
  );
}
