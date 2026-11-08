/**
 * The way back's requested time, before anyone picks one (#174).
 *
 * The client, 10/30: a round trip for the same day read "Backend rejected the
 * booking (HTTP 422)". The way out and the way back both started at 09:00, the
 * way back had to leave after the way out, and it was a hidden field. A later
 * day still starts at 09:00; the same day starts two hours after the way out,
 * so the form files as it stands.
 */
const SAME_DAY_GAP_MINUTES = 120;
const LAST_MINUTE = 23 * 60 + 59;

const pad = (n: number) => String(n).padStart(2, "0");

export function defaultReturnTime(backDay: string, wayOut: string | null): string {
  const later = `${backDay}T09:00`;
  if (!wayOut || wayOut.slice(0, 10) !== backDay) return later;
  const [hour, minute] = wayOut.slice(11, 16).split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return later;
  const at = Math.min(hour * 60 + minute + SAME_DAY_GAP_MINUTES, LAST_MINUTE);
  return `${backDay}T${pad(Math.floor(at / 60))}:${pad(at % 60)}`;
}
