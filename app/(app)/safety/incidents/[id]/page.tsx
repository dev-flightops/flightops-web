import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasAnyRole } from "@/lib/roles";
import { MANAGE_ROLES, TRIAGE_ROLES } from "@/lib/safety-roles";
import { ApiError } from "@/lib/api/client";
import {
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  INCIDENT_CATEGORY_LABELS,
  type Incident,
  getIncident,
  listCapasForSource,
} from "@/lib/api/safety";
import { IncidentTriageControls } from "./triage-controls";
import { CorrectiveActionPanel } from "@/components/safety/corrective-action-panel";


export default async function IncidentDetailPage({
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

  let incident: Incident;
  try {
    incident = await getIncident(id);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404 || err.status === 403) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  // CAPAs are board-role-gated on the backend, so only try when we
  // have a triage role. Reporters see the incident detail without
  // the CAPA panel.
  let linkedCapas: Awaited<ReturnType<typeof listCapasForSource>> | null = null;
  if (canTriage) {
    try {
      linkedCapas = await listCapasForSource("incident", id);
    } catch {
      linkedCapas = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <p className="eyebrow">
          <Link
            href={canTriage ? "/safety/incidents" : "/safety/incidents/mine"}
            className="hover:text-foreground"
          >
            ← {canTriage ? "Incidents" : "My Incident Reports"}
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 page-title">
          Incident {HAZARD_SEVERITY_LABELS[incident.severity]}
          <span className="text-sm font-normal text-muted-foreground">
            {INCIDENT_CATEGORY_LABELS[incident.category]}
          </span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Occurred {new Date(incident.occurred_at).toLocaleString()} —{" "}
          {incident.is_anonymous && !incident.reporter
            ? "Anonymous reporter"
            : incident.reporter?.full_name ?? "Unknown reporter"}
        </p>
      </header>

      {filed === "1" ? (
        <div
          role="status"
          className="mb-4 notice notice-green"
        >
          Incident filed. The Safety Officer has been notified.
        </div>
      ) : null}

      <section className="mb-6 space-y-4 rounded-lg border border-border bg-card p-5">
        <DetailRow label="Status" value={HAZARD_STATUS_LABELS[incident.status]} />
        {incident.aircraft ? (
          <DetailRow
            label="Aircraft"
            value={`${incident.aircraft.tail_number}${incident.aircraft.model ? ` (${incident.aircraft.model})` : ""}`}
          />
        ) : null}
        {incident.flight ? (
          <DetailRow
            label="Flight"
            value={incident.flight.flight_number ?? "—"}
          />
        ) : null}
        {incident.station ? (
          <DetailRow
            label="Station"
            value={`${incident.station.icao_code} — ${incident.station.name}`}
          />
        ) : null}
        {incident.location_free_text ? (
          <DetailRow label="Location" value={incident.location_free_text} />
        ) : null}
        <TextBlock label="Description" body={incident.description} />
        <TextBlock label="Injury summary" body={incident.injury_summary} />
        <TextBlock label="Damage summary" body={incident.damage_summary} />
        {incident.immediate_action_taken ? (
          <TextBlock
            label="Immediate action taken"
            body={incident.immediate_action_taken}
          />
        ) : null}
      </section>

      {incident.triaged_at || incident.closed_at ? (
        <section className="mb-6 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 eyebrow">
            Triage history
          </h2>
          <ul className="space-y-2 text-xs">
            {incident.triaged_at ? (
              <li>
                <span className="font-semibold">Triaged</span> —{" "}
                {new Date(incident.triaged_at).toLocaleString()} by{" "}
                {incident.triaged_by?.full_name ?? "unknown"}
              </li>
            ) : null}
            {incident.closed_at ? (
              <li>
                <span className="font-semibold">Closed</span> —{" "}
                {new Date(incident.closed_at).toLocaleString()} by{" "}
                {incident.closed_by?.full_name ?? "unknown"}
                {incident.closed_reason ? (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {incident.closed_reason}
                  </p>
                ) : null}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {canTriage && linkedCapas ? (
        <CorrectiveActionPanel
          sourceType="incident"
          sourceId={incident.id}
          items={linkedCapas.items}
          canOpen={canManageCapas}
        />
      ) : null}

      {canTriage && incident.status !== "closed" ? (
        <IncidentTriageControls
          incidentId={incident.id}
          currentStatus={incident.status}
        />
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

function TextBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <div className="eyebrow">
        {label}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
        {body}
      </p>
    </div>
  );
}
