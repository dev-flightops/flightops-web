import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import {
  CAPA_STATUS_LABELS,
  type CorrectiveAction,
  getCapa,
} from "@/lib/api/safety";

import { NotesForm } from "./notes-form";
import { StatusControls } from "./status-controls";

const BOARD_ROLES = new Set(["safety_officer", "chief_pilot", "exec_admin"]);
const MANAGE_ROLES = new Set(["safety_officer", "exec_admin"]);

/**
 * /safety/actions/[id] — CAPA detail.
 *
 * Board roles OR the owner can view. Owner-only endpoint updates
 * notes; Safety Officer + Exec Admin transition status. The route
 * combines both surfaces so the owner and the safety officer are
 * always looking at the same page (no context-switching between an
 * "owner view" and a "manage view").
 */
export default async function CapaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opened?: string }>;
}) {
  const { id } = await params;
  const { opened } = await searchParams;
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  const canManage = [...roles].some((r) => MANAGE_ROLES.has(r));

  let capa: CorrectiveAction;
  try {
    capa = await getCapa(id);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404 || err.status === 403) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  const isOwner = capa.owner.id === session?.user?.id;
  const canRead =
    isOwner || [...roles].some((r) => BOARD_ROLES.has(r));
  if (!canRead) notFound();

  const sourceHref =
    capa.source_type === "hazard"
      ? `/safety/${capa.source_id}`
      : `/safety/incidents/${capa.source_id}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(capa.due_date + "T00:00:00");
  const overdue = dueDate < today && capa.status !== "closed";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/safety/actions" className="hover:text-foreground">
            ← Corrective Actions
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-bold tracking-tight">
          {capa.title}
          <span
            className={
              "text-xs font-semibold uppercase tracking-wider " +
              (overdue ? "text-status-red" : "text-muted-foreground")
            }
          >
            {overdue ? "Overdue" : CAPA_STATUS_LABELS[capa.status]}
          </span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Opened {new Date(capa.created_at).toLocaleDateString()} by{" "}
          {capa.opened_by.full_name} — linked to a{" "}
          <Link href={sourceHref} className="text-status-blue hover:underline">
            {capa.source_type}
          </Link>
        </p>
      </header>

      {opened === "1" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Corrective action opened. Owner has been assigned.
        </div>
      ) : null}

      <section className="mb-6 space-y-4 rounded-lg border border-border bg-card p-5">
        <DetailRow
          label="Owner"
          value={`${capa.owner.full_name} (${capa.owner.email})`}
        />
        <DetailRow label="Due" value={dueDate.toLocaleDateString()} />
        <DetailRow label="Status" value={CAPA_STATUS_LABELS[capa.status]} />
        <div>
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Description
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
            {capa.description}
          </p>
        </div>
      </section>

      {capa.closed_at ? (
        <section className="mb-6 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Closure
          </h2>
          <p className="text-xs">
            <span className="font-semibold">Closed</span>{" "}
            {new Date(capa.closed_at).toLocaleString()} by{" "}
            {capa.closed_by?.full_name ?? "unknown"}
          </p>
          {capa.closed_reason ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {capa.closed_reason}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Notes — owner can edit; everyone can see. Closed CAPAs are
          read-only. */}
      <NotesForm
        capaId={capa.id}
        notes={capa.notes}
        canEdit={isOwner && capa.status !== "closed"}
      />

      {canManage && capa.status !== "closed" ? (
        <StatusControls capaId={capa.id} currentStatus={capa.status} />
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
