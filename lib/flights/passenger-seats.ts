import { ApiError } from "@/lib/api/client";

/**
 * Ops' refusal when a flight or its manifest would carry more passengers
 * than the aircraft's passenger seats (#107), in words. Null for any
 * other error.
 *
 * The client, 22 Oct: a Caravan has nine passenger seats, and "you can
 * take a 10th in the co pilot seat, but they have to be a check airman
 * with the company" — so the message says where that person goes.
 */
export function passengerSeatsRefusal(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  let detail: unknown;
  try {
    detail = (JSON.parse(err.message) as { detail?: unknown }).detail;
  } catch {
    return null;
  }
  if (!detail || typeof detail !== "object") return null;
  const d = detail as {
    error?: unknown;
    tail_number?: unknown;
    seats?: unknown;
    passengers?: unknown;
    leg?: unknown;
  };
  if (d.error !== "more_passengers_than_seats") return null;
  // On a flight with stops, the leg that would be over (#120).
  const where = typeof d.leg === "string" ? ` from ${d.leg.replace("-", " to ")}` : "";
  return (
    `${String(d.tail_number)} has ${String(d.seats)} passenger seats, and this would make ` +
    `${String(d.passengers)} passengers${where}. Someone in the co-pilot seat must be a company ` +
    "check airman, entered as crew."
  );
}
