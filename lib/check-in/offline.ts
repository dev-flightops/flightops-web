import type { CheckInInput, CheckInPax, CheckInView, NoShowReason } from "@/lib/api/check-in";

/**
 * Check-in taps kept on the phone while there's no signal (#119).
 *
 * The client, asked what a village agent's phone should do without
 * signal: "Auto sync once back in service." So a step that can't reach
 * the server is kept here, shown on the list at once, and sent in order
 * when the phone is back, each with the time it was taken (`at`), which is
 * what the check-in records.
 *
 * Kept in the browser's storage per flight, so a reload or a closed tab
 * doesn't lose them; they go the next time the check-in is open with
 * signal. The page itself has to have been opened with signal. Storage
 * that can't be read (a private window, storage switched off) keeps
 * nothing, and says so the same way as a refused step would.
 *
 * Opening boarding can wait for signal, as the board taps after it can.
 * A walk-up and closing boarding can't: a walk-up has no passenger to
 * check in until the manifest has them, and closing needs the server to
 * see everyone accounted for.
 */
export type QueuedStep =
  | { kind: "check-in"; paxId: string; input: CheckInInput; at: string }
  | { kind: "board" | "promote" | "reset"; paxId: string; at: string }
  | { kind: "no-show"; paxId: string; reason: NoShowReason; notes: string | null; at: string }
  | { kind: "open-boarding"; at: string };

const key = (flightId: string) => `fo-check-in-queue:${flightId}`;

export function loadQueue(flightId: string): QueuedStep[] {
  try {
    const raw = window.localStorage.getItem(key(flightId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedStep[]) : [];
  } catch {
    return [];
  }
}

/** False when the phone's storage couldn't keep it. */
export function saveQueue(flightId: string, steps: QueuedStep[]): boolean {
  try {
    if (steps.length) window.localStorage.setItem(key(flightId), JSON.stringify(steps));
    else window.localStorage.removeItem(key(flightId));
    return true;
  } catch {
    return false;
  }
}

/** Whose step it is, for saying what was kept or refused. */
export function stepPaxId(step: QueuedStep): string | null {
  return step.kind === "open-boarding" ? null : step.paxId;
}

function recount(passengers: CheckInPax[]): CheckInView["counts"] {
  const n = (status: string) => passengers.filter((p) => p.check_in_status === status).length;
  const standby = passengers.filter((p) => p.standby).length;
  return {
    booked: n("booked") - standby,
    checked_in: n("checked_in"),
    boarded: n("boarded"),
    no_show: n("no_show"),
    standby,
    total: passengers.length,
  };
}

function applyToPax(p: CheckInPax, step: QueuedStep): CheckInPax {
  switch (step.kind) {
    case "check-in": {
      const { input } = step;
      if (p.check_in_status !== "booked" && p.check_in_status !== "checked_in") return p;
      return {
        ...p,
        check_in_status: "checked_in",
        standby: false,
        checked_in_at: p.checked_in_at ?? step.at,
        weight_lbs: input.actual_weight_lbs != null ? String(input.actual_weight_lbs) : p.weight_lbs,
        baggage_lbs: input.actual_baggage_lbs != null ? String(input.actual_baggage_lbs) : p.baggage_lbs,
        planned_weight_lbs:
          input.actual_weight_lbs != null ? (p.planned_weight_lbs ?? p.weight_lbs) : p.planned_weight_lbs,
        planned_baggage_lbs:
          input.actual_baggage_lbs != null ? (p.planned_baggage_lbs ?? p.baggage_lbs) : p.planned_baggage_lbs,
        bags_count: input.bags_count ?? p.bags_count,
        seat_number: input.seat_number?.trim() ? input.seat_number.trim().toUpperCase() : p.seat_number,
        id_verified: input.id_verified,
        hazmat_declared: input.hazmat_declared ?? p.hazmat_declared,
      };
    }
    case "promote":
      return p.standby ? { ...p, check_in_status: "checked_in", standby: false, checked_in_at: step.at } : p;
    case "board":
      return p.check_in_status === "checked_in" ? { ...p, check_in_status: "boarded", boarded_at: step.at } : p;
    case "no-show":
      return p.check_in_status === "boarded"
        ? p
        : {
            ...p,
            check_in_status: "no_show",
            standby: false,
            no_show_reason: step.reason,
            no_show_notes: step.notes,
            no_show_at: step.at,
          };
    case "reset":
      if (p.check_in_status === "boarded") return p;
      return {
        ...p,
        check_in_status: "booked",
        standby: p.ticket_type === "standby",
        weight_lbs: p.planned_weight_lbs ?? p.weight_lbs,
        baggage_lbs: p.planned_baggage_lbs ?? p.baggage_lbs,
        planned_weight_lbs: null,
        planned_baggage_lbs: null,
        checked_in_at: null,
        checked_in_by_name: null,
        no_show_reason: null,
        no_show_notes: null,
        no_show_at: null,
      };
    default:
      return p;
  }
}

/** The check-in as it will be once the step reaches the server, to show
 *  at once. The server's answer replaces it when the step is sent. */
export function applyStep(view: CheckInView, step: QueuedStep): CheckInView {
  if (step.kind === "open-boarding") {
    return { ...view, boarding_opened_at: view.boarding_opened_at ?? step.at };
  }
  const passengers = view.passengers.map((p) => (p.id === step.paxId ? applyToPax(p, step) : p));
  return { ...view, passengers, counts: recount(passengers) };
}

/** Whether a check-in needs the form: the company requires something a
 *  single tap can't give (Settings → Check-in). */
export function checkInNeedsForm(view: CheckInView, pax: CheckInPax): boolean {
  const r = view.rules;
  return (
    r.require_actual_weight ||
    r.require_actual_bag_weight ||
    r.require_bags_count ||
    r.require_id_verification ||
    r.require_hazmat_declaration ||
    (r.require_seat_assignment && !pax.seat_number) ||
    view.fields.some((f) => f.is_required)
  );
}
