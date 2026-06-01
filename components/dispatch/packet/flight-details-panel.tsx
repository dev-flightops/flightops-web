import type { FlightDetail } from "@/lib/api/types";

import { DEMO_PIC_NAME } from "./demo-placeholders";
import { SectionPanel } from "./section-panel";

/**
 * Abbreviate the long aircraft model string ("Cessna 208 Caravan") to
 * the short label the legacy form uses ("208 (Caravan)"). Falls back
 * to the raw model for anything we don't recognize.
 */
function shortAircraftModel(model: string): string {
  if (/Cessna\s+208\s+Caravan/i.test(model)) return "208 (Caravan)";
  if (/Beechcraft\s+1900D/i.test(model)) return "1900D (Beech)";
  return model;
}

/**
 * Flight Details grid — matches the legacy 6-column input row
 * (`templates/dispatch/form.html` lines 121-197).
 *
 * When `flight` is supplied (the user picked one from Load from Schedule),
 * the inputs are pre-populated read-only-style. Without a selection, all
 * inputs are empty placeholders with disabled state.
 *
 * Real direct entry (typing in Flight # to load a flight, choosing a
 * different aircraft, searching for a pilot) needs:
 *   - crew-service for the pilot search (M3)
 *   - maintenance-service for the N-Number airworthiness check (M2)
 *   - weather-service for the Area Forecast Region (M2)
 *
 * Until those land the page is read-only after a dropdown selection.
 */
export function FlightDetailsPanel({ flight }: { flight?: FlightDetail | null }) {
  return (
    <SectionPanel title="Flight Details">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <Field label="Flight #" hint="press Enter to load">
          <input
            type="text"
            disabled
            placeholder="GV306"
            defaultValue={flight?.flight_number ?? ""}
            // `key` forces a re-render with a new default when the
            // selection changes — React's defaultValue is read once
            // per mount otherwise.
            key={`flight-num-${flight?.id ?? "none"}`}
            className="ff-input"
            autoComplete="off"
          />
        </Field>

        <Field label="Aircraft">
          <select
            disabled
            className="ff-input cursor-not-allowed"
            defaultValue={
              flight ? shortAircraftModel(flight.aircraft.model) : "208 (Caravan)"
            }
            key={`aircraft-${flight?.id ?? "none"}`}
          >
            <option>
              {flight ? shortAircraftModel(flight.aircraft.model) : "208 (Caravan)"}
            </option>
          </select>
        </Field>

        <Field label="N-Number">
          <input
            type="text"
            disabled
            placeholder="N12345"
            defaultValue={flight?.aircraft.tail_number ?? ""}
            key={`tail-${flight?.id ?? "none"}`}
            className="ff-input"
            autoComplete="off"
          />
        </Field>

        <Field
          label="PIC"
          help="Pilot search · Coming in M3 (crew-service)"
        >
          <input
            type="text"
            disabled
            placeholder="Type to search pilots..."
            defaultValue={flight ? DEMO_PIC_NAME : ""}
            key={`pic-${flight?.id ?? "none"}`}
            className="ff-input"
            autoComplete="off"
            title="Pilot search · Coming in M3 (crew-service)"
          />
        </Field>

        <Field label="SIC Name">
          <input
            type="text"
            disabled
            placeholder="Last, First (optional)"
            className="ff-input"
            autoComplete="off"
          />
        </Field>

        <Field label="Area Forecast Region">
          <select disabled className="ff-input cursor-not-allowed">
            <option>Southwest AK &amp; Eastern Aleutians</option>
          </select>
        </Field>
      </div>

      <PacketStyles />
    </SectionPanel>
  );
}

function Field({
  label,
  hint,
  help,
  children,
}: {
  label: string;
  /** Inline parenthetical hint shown next to the label (e.g. "press Enter to load"). */
  hint?: string;
  /** Small "?" affordance with a hover title — used for fields whose live
   * behaviour depends on a service that isn't built yet. */
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
        {hint && (
          <span className="ml-1 text-muted-foreground/70">
            ({hint})
          </span>
        )}
        {help && (
          <span
            className="ml-1 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-muted-foreground/40 text-[0.55rem] font-bold text-muted-foreground/70"
            title={help}
            aria-label={help}
          >
            ?
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

/**
 * Reusable input styling for the packet form — matches legacy `.input`
 * exactly (deeper-than-card bg, 8px radius, iOS-blue focus). Scoped to
 * the packet so we don't override the global Input primitive.
 */
export function PacketStyles() {
  return (
    <style>{`
      .ff-input {
        width: 100%;
        background: hsl(var(--background));
        color: hsl(var(--foreground));
        border: 1px solid hsl(var(--border));
        border-radius: 8px;
        padding: .5rem .75rem;
        font-size: .8125rem;
        outline: none;
        transition: border-color .15s, box-shadow .15s;
      }
      .ff-input:focus:not(:disabled) {
        border-color: hsl(var(--primary));
        box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
      }
      .ff-input:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ff-input::placeholder { color: hsl(var(--muted-foreground) / 0.5); }
      textarea.ff-input { resize: vertical; font-family: inherit; }
    `}</style>
  );
}
