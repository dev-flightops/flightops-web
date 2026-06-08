import { ApiError } from "@/lib/api/client";
import { getAirworthiness } from "@/lib/api/maintenance";
import type {
  AdvisoryIssue,
  AirworthinessResponse,
  BlockingIssue,
  FlightDetail,
} from "@/lib/api/types";

import { MelDeferralDialog } from "./mel-deferral-dialog";
import { DisabledPanel, SectionPanel } from "./section-panel";
import { SquawkDialog } from "./squawk-dialog";

/**
 * Maintenance / airworthiness panel — replaces the M1 DisabledPanel
 * placeholder that lived between Compliance Gates and Fuel.
 *
 * Hits maintenance-service `/aircraft/{id}/airworthiness` (M2-M-8) and
 * renders two grouped lists:
 *   - Blocking issues (red strip): expired MELs + open grounding squawks
 *   - Advisory issues (yellow strip): non-expired open MELs + major squawks
 *
 * A small badge in the title row gives the dispatcher the verdict at a
 * glance: AIRWORTHY (green) or NOT AIRWORTHY (red).
 *
 * The release-gating wiring in ops-service is intentionally NOT here — it
 * lands in M2-M-8b. This panel surfaces the same data; if release is
 * later refused, the reasons will already be visible on the packet.
 */
export async function MaintenancePanel({
  flight,
}: {
  flight: FlightDetail | null;
}) {
  if (!flight) {
    return (
      <DisabledPanel
        title="Maintenance & Airworthiness"
        milestone="M2"
        hint="Pick a flight from the dropdown above to check open MELs, grounding squawks, and airworthiness status for the selected aircraft."
      />
    );
  }

  let verdict: AirworthinessResponse;
  try {
    verdict = await getAirworthiness(flight.aircraft.id);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <SectionPanel title="Maintenance & Airworthiness">
        <p className="text-xs italic text-muted-foreground/70">
          {status === 404
            ? "Aircraft not found in the maintenance service."
            : "Maintenance check unavailable — try refreshing in a moment."}
        </p>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel
      title="Maintenance & Airworthiness"
      titleAction={<VerdictBadge isAirworthy={verdict.is_airworthy} />}
    >
      {verdict.blocking_issues.length === 0 &&
      verdict.advisory_issues.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No open MEL items or squawks. Tail{" "}
          <span className="font-mono font-semibold">
            {verdict.aircraft.tail_number}
          </span>{" "}
          is clear to dispatch.
        </p>
      ) : (
        <div className="space-y-3">
          {verdict.blocking_issues.length > 0 && (
            <IssueGroup
              kind="blocking"
              label="Blocking — must clear before release"
              items={verdict.blocking_issues.map((i) => ({
                kind: i.kind,
                description: i.description,
                meta: blockingMeta(i),
              }))}
            />
          )}
          {verdict.advisory_issues.length > 0 && (
            <IssueGroup
              kind="advisory"
              label="Advisory — surface to crew, but does not block"
              items={verdict.advisory_issues.map((i) => ({
                kind: i.kind,
                description: i.description,
                meta: advisoryMeta(i),
              }))}
            />
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[0.65rem] text-muted-foreground/70">
          Source: maintenance-service. Release gating against this verdict
          ships with M2-M-8b — for now this is informational only.
        </p>
        <div className="flex shrink-0 gap-2">
          <SquawkDialog
            aircraftId={verdict.aircraft.id}
            tailNumber={verdict.aircraft.tail_number}
          />
          <MelDeferralDialog
            aircraftId={verdict.aircraft.id}
            tailNumber={verdict.aircraft.tail_number}
          />
        </div>
      </div>
    </SectionPanel>
  );
}

function blockingMeta(issue: BlockingIssue): string | null {
  switch (issue.kind) {
    case "expired_mel":
      return `ATA ${issue.ata_chapter} · ${issue.days_overdue} day${issue.days_overdue === 1 ? "" : "s"} overdue`;
    case "grounding_squawk":
      return "Severity: grounding";
    default:
      return null;
  }
}

function advisoryMeta(issue: AdvisoryIssue): string | null {
  switch (issue.kind) {
    case "open_mel": {
      const days = issue.days_until_due ?? 0;
      const word = days === 1 ? "day" : "days";
      return `ATA ${issue.ata_chapter} · due in ${days} ${word}`;
    }
    case "major_squawk":
      return "Severity: major";
    default:
      return null;
  }
}

function VerdictBadge({ isAirworthy }: { isAirworthy: boolean }) {
  return (
    <span
      className={
        "rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] " +
        (isAirworthy
          ? "bg-status-green/15 text-status-green"
          : "bg-status-red/15 text-status-red")
      }
      title={
        isAirworthy
          ? "No blocking maintenance issues for this aircraft."
          : "Blocking issues present — release will be refused once M2-M-8b lands."
      }
    >
      {isAirworthy ? "Airworthy" : "Not airworthy"}
    </span>
  );
}

interface RenderableIssue {
  kind: string;
  description: string;
  meta: string | null;
}

function IssueGroup({
  kind,
  label,
  items,
}: {
  kind: "blocking" | "advisory";
  label: string;
  items: RenderableIssue[];
}) {
  const accentClass =
    kind === "blocking"
      ? "border-l-status-red bg-status-red/5"
      : "border-l-status-yellow bg-status-yellow/5";
  const dotClass =
    kind === "blocking" ? "bg-status-red" : "bg-status-yellow";

  return (
    <div>
      <p
        className={
          "mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] " +
          (kind === "blocking"
            ? "text-status-red"
            : "text-status-yellow")
        }
      >
        {label}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={
              "flex items-start gap-2 rounded-md border border-border border-l-[3px] px-3 py-2 " +
              accentClass
            }
          >
            <span
              className={"mt-1.5 inline-block h-1.5 w-1.5 rounded-full " + dotClass}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-xs leading-snug text-foreground">
                {item.description}
              </p>
              {item.meta && (
                <p className="m-0 mt-0.5 text-[0.65rem] text-muted-foreground">
                  {item.meta}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
