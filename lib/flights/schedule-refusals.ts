import type { TypedPart } from "@/lib/api/manifest";
import type { MelLimitBreach } from "@/lib/api/types";
import { loadSource } from "@/lib/flights/typed-load";
import { DEFAULT_TIME_ZONE, localClock } from "@/lib/format/local-time";
import { melLimitRemedy } from "@/lib/maintenance/mel-limits";

/**
 * What the ops service's new schedule refusals mean to a dispatcher (#155).
 * The client's TST901 flew to "ZZZZ", and N503PA was on three flights at
 * once; both are refused now, wherever a flight is made or moved.
 */

function detail(message: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return parsed.detail && typeof parsed.detail === "object"
      ? (parsed.detail as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** "09:00–11:45 AKDT": the other flight's times in the company's zone, as
 *  the form was typed (1124-26: they read in Zulu). */
function span(from: unknown, to: unknown): string {
  if (typeof from !== "string" || typeof to !== "string") return "";
  const start = localClock(from, DEFAULT_TIME_ZONE);
  const end = localClock(to, DEFAULT_TIME_ZONE);
  const [time, zone] = start.split(" ");
  return zone && end.endsWith(` ${zone}`) ? `${time}–${end}` : `${start}–${end}`;
}

function hours(n: unknown): string {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** "Pat Pilot is already on GV101 (06:00–08:00 AKDT)…": one pilot, one flight at
 *  a time (audit, 26 Nov). */
function pilotBusy(d: Record<string, unknown>): string {
  const name = String(d.full_name ?? "That pilot");
  return `${name} is already on ${String(d.flight_number ?? "another flight")} (${span(d.scheduled_departure_at, d.scheduled_arrival_at)}). A pilot can't be on two flights at once: take them off one, or choose other times.`;
}

function seatName(d: Record<string, unknown>): string {
  return `${d.seat === "sic" ? "SIC" : "PIC"} ${String(d.full_name ?? "")}`.trim();
}

/** The sentence for an unknown airport, a busy aircraft or dates that can't
 *  be right, else null. The client's BK-59414132 (18 Nov) had its first leg
 *  saved as leaving Nov 12 and landing Nov 18; such dates are refused now. */
export function scheduleRefusal(message: string): string | null {
  if (message.includes("flight_longer_than_a_day")) {
    return "The last leg lands more than 24 hours after the first leaves. Check the dates.";
  }
  if (message.includes("move_into_the_past")) {
    return "That day has passed. Check the date: a flight can't move into the past.";
  }
  if (message.includes("move_too_far")) return "That's over a year away. Check the date.";
  const d = detail(message);
  if (d?.error === "unknown_airport") {
    const codes = Array.isArray(d.codes) ? (d.codes as string[]).join(", ") : "";
    return `${codes || "An airport"} isn't an airport we know. Check the code: an Alaska airport by its ICAO or FAA identifier, or a station or village airport set up in Settings.`;
  }
  if (d?.error === "aircraft_busy") {
    return `The aircraft is already on ${String(d.flight_number ?? "another flight")} (${span(d.scheduled_departure_at, d.scheduled_arrival_at)}). Pick another aircraft or other times.`;
  }
  if (d?.error === "pilot_busy") return pilotBusy(d);
  if (d?.error === "flight_number_taken") {
    // 1124-25: two TCL3 on one day were taken.
    const at = typeof d.scheduled_departure_at === "string" ? ` at ${localClock(d.scheduled_departure_at, DEFAULT_TIME_ZONE)}` : "";
    return `${String(d.flight_number ?? "That number")} already flies that day${at}. Give this flight another number.`;
  }
  return null;
}

/** What the release's new refusals mean (#155, #181), else null. */
export function releaseRefusal(message: string): string | null {
  const d = detail(message);
  if (!d) return null;
  if (d.error === "frat_not_ready") {
    const blockers = Array.isArray(d.blockers) ? (d.blockers as { message: string }[]) : [];
    return `Release blocked — the FRAT: ${blockers.map((b) => b.message).join(" ") || "it isn't ready."}`;
  }
  if (d.error === "over_max_payload") {
    const over = Math.round(Number(d.over_by_lbs ?? 0)).toLocaleString("en-US");
    const from = loadSource(
      typeof d.basis === "string" ? d.basis : undefined,
      Array.isArray(d.typed_parts) ? (d.typed_parts as TypedPart[]) : undefined,
    );
    return `Release blocked — the load is ${over} lb over the aircraft's useful load, by ${from}.`;
  }
  if (d.error === "aircraft_weights_missing") {
    return `Release blocked — ${String(d.tail_number ?? "the aircraft")} has no max payload on record, so the load can't be checked. Set it in Settings → Fleet.`;
  }
  if (d.error === "mel_operating_limit") {
    // #200: an open MEL deferral limits the aircraft to day VFR or VFR.
    const items = Array.isArray(d.items) ? (d.items as MelLimitBreach[]) : [];
    const said = items.map((i) => i.message).filter(Boolean).join(" ");
    return `Release blocked — ${said || "an open MEL deferral limits this aircraft to day VFR or VFR."} ${melLimitRemedy(items)}`;
  }
  if (d.error === "mel_ack_required") {
    return "Release blocked — acknowledge each open MEL on the aircraft first.";
  }
  if (d.error === "crew_not_cleared") {
    // Drug and alcohol: who, never why.
    const crew = Array.isArray(d.crew) ? (d.crew as { full_name?: string; seat?: string }[]) : [];
    const names = crew.map((c) => `${c.seat === "sic" ? "SIC" : "PIC"} ${c.full_name ?? ""}`.trim()).join(", ");
    return `Release blocked — ${names || "a pilot on this flight"} isn't cleared for safety-sensitive duty under the drug and alcohol program. Ask the DER, or put another pilot on the flight.`;
  }
  if (d.error === "pilot_busy") return `Release blocked — ${pilotBusy(d)}`;
  if (d.error === "crew_rest") {
    // 14 CFR 135.267(d), audit 26 Nov.
    return `Release blocked — ${seatName(d)} has had ${hours(d.rest_hours)} hours off in a row in the 24 hours before this flight lands; 14 CFR 135.267 needs ${hours(d.required_hours)}. Put a rested pilot on the flight, or move it later.`;
  }
  if (d.error === "duty_limit") {
    return `Release blocked — ${seatName(d)}'s duty day would reach ${hours(d.duty_hours)} hours by landing, past the company's ${hours(d.limit_hours)}-hour limit. Put another pilot on the flight, or move it.`;
  }
  if (d.error === "weight_balance_out_of_limits") {
    // #181 — the pilot's ForeFlight plan: FlightOps calculates no CG itself.
    const plans = Array.isArray(d.plans) ? (d.plans as { issues?: string[] }[]) : [];
    const issues = plans.flatMap((p) => p.issues ?? []);
    return `Release blocked — ForeFlight's weight and balance is outside limits: ${issues.join("; ") || "see the plan"}. Fix the load or the plan in ForeFlight, then bring the plan back.`;
  }
  return null;
}
