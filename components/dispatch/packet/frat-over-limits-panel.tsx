"use client";

import { useActionState } from "react";

import { acceptOverLimitsAction, type AcceptOverLimitsState } from "@/app/(app)/dispatch/frat-actions";
import { buttonSolid } from "@/components/ff/controls";
import type { DispatchRisk, RiskRow } from "@/lib/api/dispatch-risk";
import type { FratOverLimits } from "@/lib/api/types";
import { factorLabel } from "@/lib/frat/factors";

const _initial: AcceptOverLimitsState = { status: "idle", attempt: 0 };

/** A matrix row in the packet's own words: "Ceiling / Visibility: no
 *  weather at PABE, scored unknown", or just the factor where the comment
 *  only repeats it ("Outside Pilot Restrictions"). */
function inWords(row: RiskRow): string {
  return row.comment && row.comment.toLowerCase() !== row.factor.toLowerCase()
    ? `${row.factor}: ${row.comment}`
    : row.factor;
}

/**
 * Why the dispatch packet asks the Chief Pilot or DO, from the risk this
 * page scored: each row it scored HIGH, each trigger of its Management
 * Approval Flag, and the stops no current weather reached (weather the
 * packet can't see scores HIGH). Nothing where that score disagrees with
 * the view, which ops reads from the score it saved last.
 *
 * The client, 17 Nov: "the FRAT was filed low but now it won't release
 * because it says it's HIGH and needs DO/chief approval". The box said
 * only that the packet scored it HIGH; a Bethel report that hadn't come
 * through was the reason.
 */
export function highRiskReasons(
  view: FratOverLimits,
  risk: DispatchRisk | null | undefined,
): { reasons: string[]; noWeather: string[] } {
  if (!risk) return { reasons: [], noWeather: [] };
  const packetHigh = view.packet_level === "high" && risk.level === "HIGH";
  const management = Boolean(view.management_required) && risk.management_required;
  const triggers = new Set<string>();
  if (management) {
    // The flag's triggers, as ops sets it: an override wins over what the
    // system worked out, and maintenance it can't answer for flags too.
    const maintenance = risk.inputs.maintenance_override ?? risk.automatic.maintenance.value;
    if (risk.inputs.outside_pilot_restrictions) triggers.add("Outside Pilot Restrictions");
    if (risk.inputs.vfr_mountain_night) triggers.add("VFR Mountain Terrain at Night");
    if (maintenance !== false) triggers.add("<4 hrs until MX");
  }
  const reasons = risk.rows
    .filter((row) => (packetHigh && row.level === "HIGH") || triggers.has(row.factor))
    .map(inWords);
  const noWeather = packetHigh
    ? (risk.stops ?? []).filter((stop) => stop.source === null).map((stop) => stop.ident)
    : [];
  return { reasons, noWeather };
}

function zulu(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  })}Z`;
}

/**
 * What the flight's FRAT waits for from the Chief Pilot or DO: factors
 * over company limits (#152), and a HIGH risk (#155), the dispatch packet
 * HIGH or the FRAT EXTREME.
 *
 * The operator, 25 Sep: "Over company limits is a no go." The client,
 * 29 Oct: "a manager override at this step. Sends a ping to chief
 * pilot/DO for an acceptance", and 10/29: "A HIGH risk score didn't
 * require management approval." They get a bell alert that opens this
 * packet; either approves here, from their own login, with a reason.
 */
export function FratOverLimitsPanel({
  view,
  canAccept,
  risk,
}: {
  view: FratOverLimits;
  /** The Chief Pilot or DO (FRAT_OVER_LIMIT_ACCEPTORS). */
  canAccept: boolean;
  /** The packet's risk as this page scored it, before reading `view`: what
   *  names the reasons for a HIGH. Pages that don't score it leave it out. */
  risk?: DispatchRisk | null;
}) {
  const [state, formAction, pending] = useActionState(acceptOverLimitsAction, _initial);
  const labels = view.over_limit_factors.map(factorLabel).join(" · ");
  const accepted = view.accepted;
  const approved = view.high_risk_approved ?? null;
  const overLimits = view.over_limit_factors.length > 0;
  const highRisk = Boolean(view.high_risk);
  const waiting = view.waiting ?? (overLimits && !accepted);
  const why = [
    view.packet_level === "high" ? "the dispatch packet scores it HIGH" : null,
    view.management_required ? "the dispatch packet flags management approval" : null,
    view.risk_level === "extreme" ? "the FRAT is EXTREME" : null,
  ].filter(Boolean);
  const { reasons, noWeather } = highRiskReasons(view, risk);

  return (
    <section
      aria-label={overLimits ? "FRAT over company limits" : "FRAT risk HIGH"}
      className={`notice text-sm ${waiting ? "notice-red" : "notice-green"}`}
    >
      <p className="notice-label">
        {overLimits
          ? accepted
            ? "FRAT over company limits — accepted"
            : "FRAT over company limits — no-go until accepted"
          : approved
            ? "Risk HIGH — approved"
            : "Risk HIGH — needs the Chief Pilot or DO"}
      </p>
      {overLimits ? (
        <p className="mt-1 text-foreground">
          {`${view.pilot_name ?? "The pilot"} filed the FRAT ${zulu(view.filed_at)} with ${labels} out of company limits.`}
        </p>
      ) : null}
      {highRisk ? (
        <p className="mt-1 text-foreground">
          {`The risk is HIGH: ${why.join(" and ") || "it needs management approval"}. The Chief Pilot or DO approves the flight before it is released.`}
        </p>
      ) : null}
      {highRisk && reasons.length > 0 ? (
        <ul aria-label="Why the packet asks for approval" className="mt-1 list-disc space-y-0.5 pl-5 text-foreground">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {highRisk && noWeather.length > 0 ? (
        <p className="mt-1 text-foreground">
          {`No current weather for ${noWeather.join(", ")}: the packet scores weather it can't see as HIGH. If a report didn't come through, reload the page to fetch the weather again.`}
        </p>
      ) : null}
      {view.mitigations ? (
        <p className="mt-1 text-muted-foreground">{`Mitigation: “${view.mitigations}”`}</p>
      ) : null}

      {accepted ? (
        <p className="mt-2 text-foreground">
          {`Accepted by ${accepted.authorizer_name} (${accepted.authorizer_role}), ${zulu(accepted.authorized_at)}${
            accepted.notes ? `: “${accepted.notes}”` : "."
          }`}
        </p>
      ) : null}
      {approved ? (
        <p className="mt-2 text-foreground">
          {`HIGH risk approved by ${approved.authorizer_name} (${approved.authorizer_role}), ${zulu(approved.authorized_at)}${
            approved.notes ? `: “${approved.notes}”` : "."
          }`}
        </p>
      ) : null}
      {waiting ? (
        canAccept ? (
          <form action={formAction} className="mt-3 space-y-2">
            <input type="hidden" name="flight_id" value={view.flight_id} />
            <label className="block">
              <span className="field-label">Why it can go</span>
              <textarea name="reason" required rows={2} className="ff-input" />
            </label>
            {state.status === "error" && state.message ? (
              <p role="alert" className="field-error">
                {state.message}
              </p>
            ) : null}
            <div className="flex justify-end">
              <button type="submit" disabled={pending} className={buttonSolid}>
                {pending
                  ? "Saving…"
                  : overLimits && !accepted
                    ? "Accept over company limits"
                    : "Approve the flight"}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-muted-foreground">
            Waiting for the Chief Pilot or the DO. They have a bell alert.
          </p>
        )
      ) : null}
    </section>
  );
}
