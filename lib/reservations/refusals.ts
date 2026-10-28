/**
 * A booking or manifest change the services refused (409), in words.
 *
 * The raw body used to reach the screen, and the booking page's own table
 * looked for `insufficient_seats` while the service says `flight_full`, so
 * a full flight read as the wire format. One table for every reservations
 * and manifest screen (#137). Anything unrecognised keeps the detail: an
 * opaque message we can't explain is still better than one we've invented.
 */
const MESSAGES: Record<string, string> = {
  flight_not_assignable_in_status_completed:
    "That flight has already been completed, so it cannot take a new booking.",
  flight_not_assignable_in_status_cancelled:
    "That flight was cancelled, so it cannot take a booking.",
  booking_cancelled: "This booking is cancelled — reinstate it first.",
  insufficient_seats: "That flight does not have enough seats left.",
  manifest_locked: "That flight's manifest is final, so its passengers can't change.",
  passengers_checked_in:
    "A passenger on this booking is checked in. Sort it out at the gate first.",
  booking_on_manifest:
    "This booking's passengers are on its flight's manifest: change them there, or cancel and rebook.",
  on_booking:
    "This passenger is on a booking. Cancel or move the booking to take them off.",
  flight_not_found: "That flight no longer exists.",
};

export function refusalMessage(raw: string): string {
  if (raw.includes("flight_full")) {
    const left = /"seats_available"\s*:\s*(\d+)/.exec(raw)?.[1];
    const needed = /"seats_requested"\s*:\s*(\d+)/.exec(raw)?.[1];
    if (left !== undefined && needed !== undefined) {
      return `That flight has ${left} seat${left === "1" ? "" : "s"} left on the legs this booking rides; it needs ${needed}.`;
    }
    return "That flight does not have enough seats left on the legs this booking rides.";
  }
  for (const [slug, sentence] of Object.entries(MESSAGES)) {
    if (raw.includes(slug)) return sentence;
  }
  return `The change was refused (${raw}).`;
}
