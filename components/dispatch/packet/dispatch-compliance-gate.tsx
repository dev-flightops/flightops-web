import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getPicCompliance, type CrewSeat } from "@/lib/api/ops";
import type {
  ComplianceFinding,
  PicComplianceResponse,
  SeatTypeStanding,
} from "@/lib/api/types";

import { OverrideDialog } from "./override-dialog";
import { SoftWarningAckList } from "./soft-warning-ack-list";
import { findingKey, findingMessage, warningAckKey } from "./soft-warning-ack-parser";

const SEAT_LABEL: Record<CrewSeat, string> = { pic: "PIC", sic: "SIC" };

/**
 * Dispatch packet compliance gate — Spec 5 §"How currency feeds
 * dispatch / Real-time compliance check on PIC selection".
 *
 * Renders a CLEAR / SOFT-WARNING / HARD-BLOCK banner for the selected
 * PIC, and one for each pilot in the flight's SIC seat. Reads from
 * `/compliance/pic-check`, which queries `pilot_currency_records`
 * directly (no calculator round-trip), for the seat each pilot flies:
 * the client's 27 Sep report was a single-pilot flight asked to
 * acknowledge the PIC's own SIC counters.
 *
 * MVP scope:
 *   - GREEN: "✓ Clear — all currency items current"
 *   - YELLOW: soft warnings listed with ack hints
 *   - RED: hard blocks listed with override-modal hint
 *
 * Deferred (real PIC dropdown lands with the M3 crew-service):
 *   - Per-warning acknowledgment checkboxes (Spec 5 §"Soft warnings
 *     — dispatcher must acknowledge")
 *   - Generate-PDF button disable on hard block
 *   - Supervisor override modal (Spec 5 §"Hard blocks") — backend
 *     endpoint exists (services #69); UI hook ships when the PIC
 *     field is real, not a demo string
 */
export async function DispatchComplianceGate({
  pilotUserId,
  prefetched,
  ackedWarnCodes,
  flightId,
  overridesAcknowledged,
  sicChecks = [],
  canOverride = false,
}: {
  /** Pilot whose compliance to check. `null` renders the awaiting
   *  state. */
  pilotUserId: string | null;
  /** The flight's SIC seat, from its crew roster, each already checked
   *  for that seat (null when the check failed). None on a single-pilot
   *  flight, which then shows no SIC banner at all. */
  sicChecks?: { pilotId: string; compliance: PicComplianceResponse | null }[];
  /** M2-G-5 — when the page-level loader already fetched the response,
   *  pass it here to skip the round-trip. */
  prefetched?: PicComplianceResponse | null;
  /** M2-G-5 tail — currency-item codes the dispatcher already ack'd
   *  via the URL. Consumed by SoftWarningAckList to render the
   *  ticked checkbox state; parent page uses the "all acked" check
   *  to enable Generate PDF. */
  ackedWarnCodes?: ReadonlySet<string>;
  /** M2-G-5 tail — passed to the override modal so the overrides
   *  audit rows carry a flight reference. Null when no flight is
   *  selected (the gate can render without one, but override
   *  requires a flight context to be useful). */
  flightId?: string | null;
  /** Every PIC hard block has a supervisor override on record for this
   *  flight (the PIC check's override_id). Hides the override button and
   *  swaps the hard-block banner tone from red to muted-red so the
   *  dispatcher knows the block was cleared. */
  overridesAcknowledged?: boolean;
  /** The viewer may record a supervisor override (OVERRIDE_AUTHORITY):
   *  the backend records the caller as the supervisor and refuses
   *  anyone else. Everyone else is told who can. */
  canOverride?: boolean;
}) {
  const acked = ackedWarnCodes ?? new Set<string>();
  const sicBanners = sicChecks.map(({ pilotId, compliance }) =>
    compliance === null ? (
      <LoadErrorBanner key={pilotId} message="SIC compliance check unavailable — refresh to retry." />
    ) : (
      <SeatBanner
        key={pilotId}
        seat="sic"
        data={compliance}
        ackedCodes={acked}
        flightId={flightId ?? null}
        overridesAcknowledged={false}
      />
    ),
  );

  if (pilotUserId === null) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-card/40 px-5 py-3.5 text-xs text-muted-foreground">
          Awaiting PIC selection — pick a pilot in the Flight Details section
          above to see compliance status.
        </div>
        {sicBanners}
      </div>
    );
  }

  let data: PicComplianceResponse | null = prefetched ?? null;
  let loadError: string | null = null;
  if (prefetched === undefined) {
    try {
      data = await getPicCompliance(pilotUserId, "pic", flightId ?? null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          loadError = "Sign in to see compliance status.";
        } else if (err.status === 404) {
          loadError = "PIC record not found.";
        } else {
          loadError = `Compliance check failed (HTTP ${err.status}).`;
        }
      } else {
        loadError = "Compliance check failed.";
      }
    }
  } else if (prefetched === null) {
    loadError = "Compliance check unavailable — refresh to retry.";
  }

  return (
    <div className="space-y-3">
      {loadError ? (
        <LoadErrorBanner message={loadError} />
      ) : data ? (
        <SeatBanner
          seat="pic"
          data={data}
          ackedCodes={acked}
          flightId={flightId ?? null}
          overridesAcknowledged={overridesAcknowledged ?? false}
          canOverride={canOverride}
        />
      ) : null}
      {sicBanners}
    </div>
  );
}

function LoadErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-5 py-3.5 text-xs text-status-yellow"
    >
      {message}
    </div>
  );
}

function SeatBanner({
  seat,
  data,
  ackedCodes,
  flightId,
  overridesAcknowledged,
  canOverride = false,
}: {
  seat: CrewSeat;
  data: PicComplianceResponse;
  ackedCodes: ReadonlySet<string>;
  flightId: string | null;
  overridesAcknowledged: boolean;
  canOverride?: boolean;
}) {
  if (data.dot_color === "red") {
    return (
      <HardBlockBanner
        seat={seat}
        data={data}
        ackedCodes={ackedCodes}
        flightId={flightId}
        overridesAcknowledged={overridesAcknowledged}
        canOverride={canOverride}
      />
    );
  }
  if (data.dot_color === "yellow") {
    return <SoftWarningBanner seat={seat} data={data} ackedCodes={ackedCodes} />;
  }
  return <ClearBanner seat={seat} data={data} />;
}

function ClearBanner({
  seat,
  data,
}: {
  seat: CrewSeat;
  data: PicComplianceResponse;
}) {
  return (
    <div className="rounded-md border border-status-green/40 bg-status-green/[0.08] px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <Dot color="green" />
        <span className="font-bold uppercase tracking-[0.06em] text-status-green">
          Clear — all currency items current
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <PilotLine
          seat={seat}
          pilot={data.pilot}
          accent="text-status-green"
          hint="Fully compliant"
        />
        <ViewProfileLink pilotId={data.pilot.id} />
      </div>
      <TypeStandingLine seat={seat} standing={data.type_standing} />
    </div>
  );
}

function SoftWarningBanner({
  seat,
  data,
  ackedCodes,
}: {
  seat: CrewSeat;
  data: PicComplianceResponse;
  ackedCodes: ReadonlySet<string>;
}) {
  const unackedCount = data.soft_warnings.filter(
    (w) => !ackedCodes.has(warningAckKey(seat, w.code)),
  ).length;
  const allAcked = unackedCount === 0;
  return (
    <div
      className={
        "rounded-md border px-5 py-4 " +
        (allAcked
          ? "border-status-green/40 bg-status-green/[0.06]"
          : "border-status-yellow/40 bg-status-yellow/[0.08]")
      }
    >
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <Dot color={allAcked ? "green" : "yellow"} />
        <span
          className={
            "font-bold uppercase tracking-[0.06em] " +
            (allAcked ? "text-status-green" : "text-status-yellow")
          }
        >
          {allAcked
            ? "All soft warnings acknowledged — release enabled"
            : "Soft warning — ack required before release"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <PilotLine
          seat={seat}
          pilot={data.pilot}
          accent={allAcked ? "text-status-green" : "text-status-yellow"}
          hint={
            allAcked
              ? "Cleared for release"
              : `${unackedCount} of ${data.soft_warnings.length} still need ack`
          }
        />
        <ViewProfileLink pilotId={data.pilot.id} />
      </div>
      <TypeStandingLine seat={seat} standing={data.type_standing} />
      <SoftWarningAckList
        seat={seat}
        findings={data.soft_warnings}
        ackedCodes={ackedCodes}
      />
    </div>
  );
}

function HardBlockBanner({
  seat,
  data,
  ackedCodes,
  flightId,
  overridesAcknowledged,
  canOverride,
}: {
  seat: CrewSeat;
  data: PicComplianceResponse;
  ackedCodes: ReadonlySet<string>;
  flightId: string | null;
  overridesAcknowledged: boolean;
  canOverride: boolean;
}) {
  return (
    <div
      className={
        "rounded-md border px-5 py-4 " +
        (overridesAcknowledged
          ? "border-status-yellow/50 bg-status-yellow/[0.06]"
          : "border-status-red/40 bg-status-red/[0.08]")
      }
    >
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <Dot color={overridesAcknowledged ? "yellow" : "red"} />
        <span
          className={
            "font-bold uppercase tracking-[0.06em] " +
            (overridesAcknowledged
              ? "text-status-yellow"
              : "text-status-red")
          }
        >
          {overridesAcknowledged
            ? "Hard block — supervisor override recorded"
            : "Hard block — pilot cannot fly Part 135"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <PilotLine
          seat={seat}
          pilot={data.pilot}
          accent={
            overridesAcknowledged ? "text-status-yellow" : "text-status-red"
          }
          hint={
            overridesAcknowledged
              ? "Cleared for release with audit trail on record"
              : seat === "sic"
                ? "Assign a current SIC in the Crew panel, or clear the items"
                : "Supervisor override required to release"
          }
        />
        <ViewProfileLink pilotId={data.pilot.id} />
      </div>
      <TypeStandingLine seat={seat} standing={data.type_standing} />
      <FindingsList findings={data.hard_blocks} tone="hard" />
      {/* The override records PIC deviations; an SIC is replaced. The
          supervisor records it from their own login (the operator's
          choice, 29 Sep), so nobody else is offered the button. */}
      {!overridesAcknowledged &&
        seat === "pic" &&
        (canOverride ? (
          <OverrideDialog
            pilotUserId={data.pilot.id}
            pilotName={data.pilot.full_name}
            hardBlocks={data.hard_blocks}
            flightId={flightId}
          />
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Only a Chief Pilot, Director of Operations or Exec Admin can
            record an override, from their own login. They can open this
            packet and do it here.
          </p>
        ))}
      {data.soft_warnings.length > 0 && (
        <>
          <div className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-yellow">
            Also pending acknowledgment
          </div>
          <SoftWarningAckList
            seat={seat}
            findings={data.soft_warnings}
            ackedCodes={ackedCodes}
          />
        </>
      )}
    </div>
  );
}

function PilotLine({
  seat,
  pilot,
  accent,
  hint,
}: {
  seat: CrewSeat;
  pilot: PicComplianceResponse["pilot"];
  accent: string;
  hint: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-3 text-xs">
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {SEAT_LABEL[seat]}
      </span>
      <span className="font-semibold text-foreground">{pilot.full_name}</span>
      <span className={`font-semibold ${accent}`}>{hint}</span>
    </div>
  );
}

const TYPE_STATE_LABEL: Record<SeatTypeStanding["state"], string> = {
  current: "current",
  grace: "in a grace month",
  non_current: "not current",
  not_authorised: "not authorised",
};

/** The pilot's standing in this seat on the aircraft's type (#46). Where
 *  the company enforces it, a PIC who isn't current is also a hard block
 *  above; otherwise this line is the only place it shows. */
function TypeStandingLine({
  seat,
  standing,
}: {
  seat: CrewSeat;
  standing: SeatTypeStanding | null | undefined;
}) {
  if (!standing) return null;
  const ok = standing.state === "current";
  const tone = ok
    ? "text-status-green"
    : standing.state === "grace"
      ? "text-status-yellow"
      : standing.enforced && seat === "pic"
        ? "text-status-red"
        : "text-muted-foreground";
  const note = ok
    ? null
    : seat === "sic"
      ? "Release checks the PIC's type only."
      : standing.enforced
        ? null
        : "Not checked at release: aircraft qualifications are off in Settings → Currency.";
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs">
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Aircraft
      </span>
      <span className={`font-semibold ${tone}`}>
        {SEAT_LABEL[seat]} on {standing.airframe_type.toUpperCase()}:{" "}
        {TYPE_STATE_LABEL[standing.state]}
      </span>
      {note && <span className="text-muted-foreground">{note}</span>}
    </p>
  );
}

function ViewProfileLink({ pilotId }: { pilotId: string }) {
  return (
    <Link
      href={`/compliance/pilots/${pilotId}`}
      className="text-xs font-semibold text-primary hover:underline"
    >
      View profile →
    </Link>
  );
}

function FindingsList({
  findings,
  tone,
}: {
  findings: ComplianceFinding[];
  tone: "soft" | "hard";
}) {
  const dotClass =
    tone === "hard" ? "bg-status-red" : "bg-status-yellow";
  return (
    <ul className="mt-2 space-y-1 text-[0.7rem]">
      {findings.map((finding) => (
        <li
          key={findingKey(finding)}
          className="flex items-start gap-2 text-foreground/90"
        >
          <span
            className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
            aria-hidden
          />
          <span>
            <span className="font-semibold">{finding.name}</span>
            <span className="text-muted-foreground"> ({finding.regulation})</span>
            {" — "}
            <span>{findingMessage(finding)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Dot({ color }: { color: "green" | "yellow" | "red" }) {
  const cls =
    color === "red"
      ? "bg-status-red"
      : color === "yellow"
        ? "bg-status-yellow"
        : "bg-status-green";
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`}
      aria-hidden
    />
  );
}
