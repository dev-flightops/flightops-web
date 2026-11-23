import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/roles";
import { MANAGE_ROLES, TRIAGE_ROLES } from "@/lib/safety-roles";
import { ApiError } from "@/lib/api/client";
import { loadZoneTable } from "@/lib/api/auth";
import { localDateTime } from "@/lib/format/local-time";
import {
  HAZARD_CATEGORY_LABELS,
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  type HazardReport,
  getHazard,
  listCapasForSource,
} from "@/lib/api/safety";
import { CorrectiveActionPanel } from "@/components/safety/corrective-action-panel";

import { TriageControls } from "./triage-controls";


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
  const canTriage = hasAnyRole([...roles], TRIAGE_ROLES);
  const canManageCapas = hasAnyRole([...roles], MANAGE_ROLES);
  // Times in the company's zone (1119-22): the server's own is UTC, so a
  // hazard filed on an Alaska evening read as the next morning.
  const zones = loadZoneTable();

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

  // CAPAs are board-role-gated; only fetch when we can render the
  // panel. Reporters see the hazard detail without it.
  let linkedCapas: Awaited<ReturnType<typeof listCapasForSource>> | null = null;
  if (canTriage) {
    try {
      linkedCapas = await listCapasForSource("hazard", id);
    } catch {
      linkedCapas = null;
    }
  }

  const zone = (await zones).fallback;
  const at = (iso: string) => localDateTime(iso, zone, { withYear: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <p className="eyebrow">
          <Link
            href={canTriage ? "/safety" : "/safety/mine"}
            className="hover:text-foreground"
          >
            ← {canTriage ? "Safety SMS" : "My Reports"}
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 page-title">
          Hazard {HAZARD_SEVERITY_LABELS[hazard.severity]}
          <span className="text-sm font-normal text-muted-foreground">
            {HAZARD_CATEGORY_LABELS[hazard.category]}
          </span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Filed {at(hazard.created_at)} —{" "}
          {hazard.is_anonymous && !hazard.reporter
            ? "Anonymous reporter"
            : hazard.reporter?.full_name ?? "Unknown reporter"}
        </p>
      </header>

      {filed === "1" ? (
        <div
          role="status"
          className="mb-4 notice notice-green"
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
          <div className="eyebrow">
            Description
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
            {hazard.description}
          </p>
        </div>
        {hazard.immediate_action_taken ? (
          <div>
            <div className="eyebrow">
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
          <h2 className="mb-3 eyebrow">
            Triage history
          </h2>
          <ul className="space-y-2 text-xs">
            {hazard.triaged_at ? (
              <li>
                <span className="font-semibold">Triaged</span> —{" "}
                {at(hazard.triaged_at)} by{" "}
                {hazard.triaged_by?.full_name ?? "unknown"}
              </li>
            ) : null}
            {hazard.closed_at ? (
              <li>
                <span className="font-semibold">Closed</span> —{" "}
                {at(hazard.closed_at)} by{" "}
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

      {canTriage && linkedCapas ? (
        <CorrectiveActionPanel
          sourceType="hazard"
          sourceId={hazard.id}
          items={linkedCapas.items}
          canOpen={canManageCapas}
        />
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
      <span className="eyebrow">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
