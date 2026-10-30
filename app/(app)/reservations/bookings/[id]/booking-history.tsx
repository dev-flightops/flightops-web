import type { BookingChange } from "@/lib/api/reservations";
import { formatZuluDateTime } from "@/lib/format/flight-time";

/**
 * A booking's history of edits (#147), newest first: what each field was,
 * what it became, who changed it and when. Legacy kept the same log
 * (`log_booking_change`). Pure, so it's tested without the page.
 */

const FIELD_LABELS: Record<string, string> = {
  origin_icao: "From",
  destination_icao: "To",
  requested_departure_at: "Departure",
  estimated_arrival_at: "Est. arrival",
  aircraft_id: "Aircraft",
  pax_count: "Pax",
  cargo_notes: "Cargo",
  quoted_total_cents: "Quote",
  notes: "Notes",
  passengers: "Passengers",
};

const TIMES = new Set(["requested_departure_at", "estimated_arrival_at"]);

export function historyValue(field: string, value: string | null): string {
  if (value === null || value === "") return "—";
  if (TIMES.has(field)) return formatZuluDateTime(value);
  if (field === "quoted_total_cents") return `$${(Number(value) / 100).toFixed(2)}`;
  return value;
}

export function BookingHistory({ changes }: { changes: BookingChange[] }) {
  if (changes.length === 0) return null;
  return (
    <section aria-labelledby="booking-history" className="mb-6 rounded-lg border border-border bg-card p-5">
      <h2 id="booking-history" className="mb-3 eyebrow">
        Changes
      </h2>
      <ul className="divide-y divide-border text-xs">
        {changes.map((c) => (
          <li key={c.id} className="py-2">
            <span className="font-semibold">{FIELD_LABELS[c.field] ?? c.field}</span>
            {": "}
            {historyValue(c.field, c.old_value)} → {historyValue(c.field, c.new_value)}
            <span className="block text-muted-foreground">
              {formatZuluDateTime(c.changed_at)}
              {c.changed_by_name ? ` by ${c.changed_by_name}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
