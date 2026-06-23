import type { FlightLogResponse } from "@/lib/api/types";

import { FLIGHT_TYPE_LABELS } from "./flight-type-labels";

/**
 * Tab 1 — Flight Info. Read-only render of the fields already on the
 * FlightLog row: number, type, date, aircraft, creator. Editable
 * fields (hobbs, log page number, PIC/SIC names) ship as follow-ups
 * once the backend has the underlying columns.
 *
 * Mirrors the top half of legacy log_page.html Tab 1 — same field
 * order so a pilot moving between systems stays oriented.
 */
export function FlightInfoTab({ log }: { log: FlightLogResponse }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Flight Info
      </h2>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ReadOnlyField label="Flight Number" value={log.flight_number ?? "—"} />
        <ReadOnlyField label="Log Number" value={log.log_number} mono />
        <ReadOnlyField label="Flight Type" value={FLIGHT_TYPE_LABELS[log.flight_type]} />
        <ReadOnlyField label="Date" value={log.flight_date} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ReadOnlyField label="Tail" value={log.aircraft.tail_number} mono />
        <ReadOnlyField label="Model" value={log.aircraft.model ?? "—"} />
        <ReadOnlyField label="Seats" value={String(log.aircraft.seats)} />
        <ReadOnlyField label="Created By" value={log.created_by.full_name} />
      </div>

      {log.is_manual_entry && (
        <p className="rounded-md border border-status-yellow/40 bg-status-yellow/[0.05] px-3 py-2 text-[0.7rem] text-status-yellow">
          This log was started without a dispatch packet. The MANUAL ENTRY
          badge is permanent and will appear in the flight history table.
        </p>
      )}

      <p className="rounded-md border border-dashed border-border bg-card/40 px-3 py-2 text-[0.7rem] text-muted-foreground">
        Editable Tab-1 fields (Hobbs start/end, total block/flight time, log
        page number, PIC/SIC names) ship as a follow-up — they need their
        backend columns first.
      </p>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          mono
            ? "rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            : "rounded-md border border-border bg-background px-3 py-2 text-xs"
        }
      >
        {value}
      </div>
    </div>
  );
}
