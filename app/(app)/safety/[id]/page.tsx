import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import {
  HAZARD_CATEGORY_LABELS,
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  type HazardReport,
  getHazard,
} from "@/lib/api/safety";

import { TriageControls } from "./triage-controls";

const TRIAGE_ROLES = new Set(["safety_officer", "chief_pilot", "exec_admin"]);

/**
 * /safety/[id] — Hazard detail + triage controls.
 *
 * Two audiences share the page:
 *   * Triage roles (Safety Officer, Chief Pilot, Exec Admin) see the
 *     status transition controls beneath the description.
 *   * The reporter themselves can see their own hazard read-only. If
 *     the current user is neither the reporter nor a triage role, the
 *     backend returns 403 and we render a bare "not found" — same
 *     surface as the URL not existing.
 */
export default async function SafetyHazardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filed?: string }>;
}) {
  const { id } = await params;
  const { filed } = await searchParams;
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  const canTriage = [...roles].some((r) => TRIAGE_ROLES.has(r));

  let hazard: HazardReport;
  try {
    hazard = await getHazard(id);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404 || err.status === 403) {
        // Non-triage users hitting a hazard that isn't theirs land on
        // notFound() so the URL doesn't disclose that a hazard exists.
        // The reporter's own /mine feed remains the intended entry
        // point for authored reports.
        notFound();
      }
      if (err.status === 401) {
        redirect("/login");
      }
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link
            href={canTriage ? "/safety" : "/safety/mine"}
            className="hover:text-foreground"
          >
            ← {canTriage ? "Safety SMS" : "My Reports"}
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-bold tracking-tight">
          Hazard {HAZARD_SEVERITY_LABELS[hazard.severity]}
          <span className="text-sm font-normal text-muted-foreground">
            {HAZARD_CATEGORY_LABELS[hazard.category]}
          </span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Filed {new Date(hazard.created_at).toLocaleString()} —{" "}
          {hazard.is_anonymous && !hazard.reporter
            ? "Anonymous reporter"
            : hazard.reporter?.full_name ?? "Unknown reporter"}
        </p>
      </header>

      {filed === "1" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Report filed. The Safety Officer has been notified.
        </div>
      ) : null}

      <section className="mb-6 space-y-4 rounded-lg border border-border bg-card p-5">
        <DetailRow label="Status" value={HAZARD_STATUS_LABELS[hazard.status]} />
        {hazard.station ? (
          <DetailRow
            label="Station"
            value={`${hazard.station.icao_code} — ${hazard.station.name}`}
          />
        ) : null}
        {hazard.location_free_text ? (
          <DetailRow label="Location" value={hazard.location_free_text} />
        ) : null}
        <div>
          <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Description
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
            {hazard.description}
          </p>
        </div>
        {hazard.immediate_action_taken ? (
          <div>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Immediate action taken
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
              {hazard.immediate_action_taken}
            </p>
          </div>
        ) : null}
      </section>

      {hazard.triaged_at || hazard.closed_at ? (
        <section className="mb-6 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Triage history
          </h2>
          <ul className="space-y-2 text-xs">
            {hazard.triaged_at ? (
              <li>
                <span className="font-semibold">Triaged</span> —{" "}
                {new Date(hazard.triaged_at).toLocaleString()} by{" "}
                {hazard.triaged_by?.full_name ?? "unknown"}
              </li>
            ) : null}
            {hazard.closed_at ? (
              <li>
                <span className="font-semibold">Closed</span> —{" "}
                {new Date(hazard.closed_at).toLocaleString()} by{" "}
                {hazard.closed_by?.full_name ?? "unknown"}
                {hazard.closed_reason ? (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {hazard.closed_reason}
                  </p>
                ) : null}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {canTriage && hazard.status !== "closed" ? (
        <TriageControls hazardId={hazard.id} currentStatus={hazard.status} />
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
