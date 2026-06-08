import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/client";
import { getAirworthiness } from "@/lib/api/maintenance";
import type {
  AdvisoryIssue,
  AirworthinessResponse,
  BlockingIssue,
  FlightDetail,
} from "@/lib/api/types";

import { CloseMelDialog } from "./close-mel-dialog";
import { MelDeferralDialog } from "./mel-deferral-dialog";
import { ResolveSquawkDialog } from "./resolve-squawk-dialog";
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
 * M2-G-17: each row that maps to a known MEL or squawk id gets an inline
 * Close / Resolve button. The action posts to the matching backend
 * endpoint (POST /mel-items/{id}/close or POST /squawks/{id}/resolve)
 * and refreshes the panel — verdict updates immediately, item disappears
 * from the list, blocking-issue count drops, and the release gate
 * (M2-M-8b) unsticks if that was the last blocking issue.
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
                action: blockingAction(i),
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
                action: advisoryAction(i),
              }))}
            />
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[0.65rem] text-muted-foreground/70">
          Source: maintenance-service. Release-gating against this verdict
          ships in M2-M-8b.
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

/** Picks the right action button (Close MEL vs Resolve squawk) based on
 *  the issue kind. Returns null when we don't have the id we need —
 *  shouldn't happen given the backend contract, but be defensive. */
function blockingAction(issue: BlockingIssue): ReactNode {
  if (issue.kind === "expired_mel" && issue.mel_item_id && issue.ata_chapter) {
    return (
      <CloseMelDialog
        melItemId={issue.mel_item_id}
        ataChapter={issue.ata_chapter}
        description={issue.description}
      />
    );
  }
  if (issue.kind === "grounding_squawk" && issue.squawk_id) {
    return (
      <ResolveSquawkDialog
        squawkId={issue.squawk_id}
        title={issue.description}
        severity="grounding"
      />
    );
  }
  return null;
}

function advisoryAction(issue: AdvisoryIssue): ReactNode {
  if (issue.kind === "open_mel" && issue.mel_item_id && issue.ata_chapter) {
    return (
      <CloseMelDialog
        melItemId={issue.mel_item_id}
        ataChapter={issue.ata_chapter}
        description={issue.description}
      />
    );
  }
  if (issue.kind === "major_squawk" && issue.squawk_id) {
    return (
      <ResolveSquawkDialog
        squawkId={issue.squawk_id}
        title={issue.description}
        severity="major"
      />
    );
  }
  return null;
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
          : "Blocking issues present — release will be refused (M2-M-8b)."
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
  /** Per-row action button (Close MEL / Resolve squawk). null when the
   *  issue's id wasn't in the verdict (shouldn't happen). */
  action: ReactNode;
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
            {item.action && <div className="shrink-0">{item.action}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
