import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getComplianceBoard } from "@/lib/api/ops";
import type { FlightLogResponse, UserRef } from "@/lib/api/types";

import { FLIGHT_TYPE_LABELS } from "./flight-type-labels";
import { SicPicker } from "./sic-picker";

/**
 * Tab 1 — Flight Info. Read-only render of the fields on the
 * FlightLog row plus the editable SIC picker (when the log is in
 * draft state).
 *
 * Mirrors the top half of legacy log_page.html Tab 1 — same field
 * order so a pilot moving between systems stays oriented.
 *
 * The SIC picker sources its roster from `getComplianceBoard()`'s
 * pilot list (every active pilot in the tenant) — no dedicated
 * roster endpoint needed for the picker. Loading the board is
 * heavier than a bare user list, but it's already accessible to
 * any logged-in tenant user.
 */
export async function FlightInfoTab({ log }: { log: FlightLogResponse }) {
  const session = await auth();
  const selfUserId = session?.user?.id ?? "";

  let candidates: UserRef[] = [];
  let rosterError: string | null = null;
  try {
    const board = await getComplianceBoard();
    candidates = board.rows.map((r) => r.pilot);
  } catch (err) {
    rosterError =
      err instanceof ApiError && err.status === 401
        ? "Sign in to assign a SIC."
        : "Pilot roster unavailable. Refresh to retry.";
  }

  const readOnly = log.status !== "draft";

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
        <ReadOnlyField label="Created By (PIC)" value={log.created_by.full_name} />
      </div>

      <div className="rounded-md border border-border bg-card/40 p-3">
        {rosterError ? (
          <p role="alert" className="text-[0.7rem] text-status-yellow">
            {rosterError}
          </p>
        ) : (
          <SicPicker
            logId={log.id}
            initialSic={log.sic_user ?? null}
            candidates={candidates}
            selfUserId={selfUserId}
            readOnly={readOnly}
          />
        )}
      </div>

      {log.is_manual_entry && (
        <p className="rounded-md border border-status-yellow/40 bg-status-yellow/[0.05] px-3 py-2 text-[0.7rem] text-status-yellow">
          This log was started without a dispatch packet. The MANUAL ENTRY
          badge is permanent and will appear in the flight history table.
        </p>
      )}

      <p className="rounded-md border border-dashed border-border bg-card/40 px-3 py-2 text-[0.7rem] text-muted-foreground">
        Editable Tab-1 fields (Hobbs start/end, total block/flight time, log
        page number) ship as a follow-up — they need their backend columns
        first.
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
