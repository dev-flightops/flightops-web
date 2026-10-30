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

function hhmmZ(iso: unknown): string {
  return typeof iso === "string" && iso.length >= 16 ? `${iso.slice(11, 16)}Z` : "";
}

/** The sentence for an unknown airport or a busy aircraft, else null. */
export function scheduleRefusal(message: string): string | null {
  const d = detail(message);
  if (d?.error === "unknown_airport") {
    const codes = Array.isArray(d.codes) ? (d.codes as string[]).join(", ") : "";
    return `${codes || "An airport"} isn't an airport we know. Check the code: an Alaska airport by its ICAO or FAA identifier, or a station or village airport set up in Settings.`;
  }
  if (d?.error === "aircraft_busy") {
    return `The aircraft is already on ${String(d.flight_number ?? "another flight")} (${hhmmZ(d.scheduled_departure_at)}–${hhmmZ(d.scheduled_arrival_at)}). Pick another aircraft or other times.`;
  }
  return null;
}

/** What the release's new refusals mean (#155), else null. */
export function releaseRefusal(message: string): string | null {
  const d = detail(message);
  if (!d) return null;
  if (d.error === "frat_not_ready") {
    const blockers = Array.isArray(d.blockers) ? (d.blockers as { message: string }[]) : [];
    return `Release blocked — the FRAT: ${blockers.map((b) => b.message).join(" ") || "it isn't ready."}`;
  }
  if (d.error === "over_max_payload") {
    const over = Math.round(Number(d.over_by_lbs ?? 0)).toLocaleString("en-US");
    const from =
      d.basis === "manifest"
        ? "the manifest"
        : "the passengers and cargo typed on the flight (no manifest yet; passengers at 190 lb)";
    return `Release blocked — the load is ${over} lb over the aircraft's useful load, by ${from}.`;
  }
  if (d.error === "aircraft_weights_missing") {
    return `Release blocked — ${String(d.tail_number ?? "the aircraft")} has no max payload on record, so the load can't be checked. Set it in Settings → Fleet.`;
  }
  if (d.error === "mel_ack_required") {
    return "Release blocked — acknowledge each open MEL on the aircraft first.";
  }
  return null;
}
