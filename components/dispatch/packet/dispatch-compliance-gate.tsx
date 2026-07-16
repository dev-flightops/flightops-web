import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getPicCompliance } from "@/lib/api/ops";
import type {
  ComplianceFinding,
  PicComplianceResponse,
} from "@/lib/api/types";

/**
 * Dispatch packet compliance gate — Spec 5 §"How currency feeds
 * dispatch / Real-time compliance check on PIC selection".
 *
 * Renders a CLEAR / SOFT-WARNING / HARD-BLOCK banner for the selected
 * PIC. Reads from `/compliance/pic-check`, which queries
 * `pilot_currency_records` directly (no calculator round-trip).
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
}: {
  /** Pilot whose compliance to check. `null` renders the awaiting
   *  state. */
  pilotUserId: string | null;
  /** M2-G-5 — when the page-level loader already fetched the response,
   *  pass it here to skip the round-trip. Falls back to fetching if
   *  undefined (older callers). */
  prefetched?: PicComplianceResponse | null;
}) {
  if (pilotUserId === null) {
    return (
      <div className="rounded-md border border-border bg-card/40 px-5 py-3.5 text-xs text-muted-foreground">
        Awaiting PIC selection — pick a pilot in the Flight Details section
        above to see compliance status.
      </div>
    );
  }

  let data: PicComplianceResponse | null = prefetched ?? null;
  let loadError: string | null = null;
  if (prefetched === undefined) {
    try {
      data = await getPicCompliance(pilotUserId);
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

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-5 py-3.5 text-xs text-status-yellow"
      >
        {loadError}
      </div>
    );
  }

  if (!data) return null;

  if (data.dot_color === "red") {
    return <HardBlockBanner data={data} />;
  }
  if (data.dot_color === "yellow") {
    return <SoftWarningBanner data={data} />;
  }
  return <ClearBanner data={data} />;
}

function ClearBanner({ data }: { data: PicComplianceResponse }) {
  return (
    <div className="rounded-md border border-status-green/40 bg-status-green/[0.08] px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <Dot color="green" />
        <span className="font-bold uppercase tracking-[0.06em] text-status-green">
          Clear — all currency items current
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <PilotLine pilot={data.pilot} accent="text-status-green" hint="Fully compliant" />
        <ViewProfileLink pilotId={data.pilot.id} />
      </div>
    </div>
  );
}

function SoftWarningBanner({ data }: { data: PicComplianceResponse }) {
  return (
    <div className="rounded-md border border-status-yellow/40 bg-status-yellow/[0.08] px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <Dot color="yellow" />
        <span className="font-bold uppercase tracking-[0.06em] text-status-yellow">
          Soft warning — ack required before release
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <PilotLine
          pilot={data.pilot}
          accent="text-status-yellow"
          hint={`${data.soft_warnings.length} item${data.soft_warnings.length === 1 ? "" : "s"} need dispatcher ack`}
        />
        <ViewProfileLink pilotId={data.pilot.id} />
      </div>
      <FindingsList findings={data.soft_warnings} tone="soft" />
    </div>
  );
}

function HardBlockBanner({ data }: { data: PicComplianceResponse }) {
  return (
    <div className="rounded-md border border-status-red/40 bg-status-red/[0.08] px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <Dot color="red" />
        <span className="font-bold uppercase tracking-[0.06em] text-status-red">
          Hard block — pilot cannot fly Part 135
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <PilotLine
          pilot={data.pilot}
          accent="text-status-red"
          hint="Supervisor override required to release"
        />
        <ViewProfileLink pilotId={data.pilot.id} />
      </div>
      <FindingsList findings={data.hard_blocks} tone="hard" />
      {data.soft_warnings.length > 0 && (
        <>
          <div className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-yellow">
            Also pending acknowledgment
          </div>
          <FindingsList findings={data.soft_warnings} tone="soft" />
        </>
      )}
    </div>
  );
}

function PilotLine({
  pilot,
  accent,
  hint,
}: {
  pilot: PicComplianceResponse["pilot"];
  accent: string;
  hint: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-3 text-xs">
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        PIC
      </span>
      <span className="font-semibold text-foreground">{pilot.full_name}</span>
      <span className={`font-semibold ${accent}`}>{hint}</span>
    </div>
  );
}

function ViewProfileLink({ pilotId }: { pilotId: string }) {
  return (
    <Link
      href={`/compliance/pilots/${pilotId}`}
      className="text-xs font-semibold text-status-blue hover:underline"
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
          key={finding.currency_item_id}
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
            <span>{finding.message}</span>
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
