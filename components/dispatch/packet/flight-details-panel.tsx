import type { FlightDetail } from "@/lib/api/types";

import { PicPicker, type PicOption } from "./pic-picker";
import { SectionPanel } from "./section-panel";

/**
 * Abbreviate the long aircraft model string ("Cessna 208 Caravan") to
 * the short label the legacy form uses ("208 (Caravan)"). Falls back
 * to the raw model for anything we don't recognize; renders a dash
 * placeholder when the aircraft has no model on file (nullable since
 * flightops-services migration 0023).
 */
function shortAircraftModel(model: string | null): string {
  if (!model) return "—";
  if (/Cessna\s+208\s+Caravan/i.test(model)) return "208 (Caravan)";
  if (/Beechcraft\s+1900D/i.test(model)) return "1900D (Beech)";
  return model;
}

/**
 * Flight Details grid — matches the legacy 6-column input row
 * (`templates/dispatch/form.html` lines 121-197).
 *
 * All six controls are enabled for direct entry (legacy parity). When
 * `flight` is supplied (dispatcher picked one from Load from Schedule),
 * the inputs pre-populate but stay editable — matches how legacy handles
 * overrides. Live behaviour behind each field:
 *   - Flight # / N-Number: freeform today, live lookup lands with the
 *     Flight # search API (backend exists; wiring pending)
 *   - Aircraft / Area Forecast Region: static <select> options, submit
 *     captures the selection
 *   - PIC / SIC: freeform text; typeahead search ships with crew-service
 *     in M3
 */
export function FlightDetailsPanel({
  flight,
  picOptions,
  currentPicId,
}: {
  flight?: FlightDetail | null;
  /** Pilot roster + overall status for the PIC dropdown (M2-G-5). */
  picOptions: PicOption[];
  /** Currently-selected PIC from ?pic=<uuid>. */
  currentPicId: string | null;
}) {
  return (
    <SectionPanel title="Flight Details">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <Field label="Flight #" hint="press Enter to load">
          <input
            type="text"
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
            className="ff-input"
            defaultValue={
              flight ? shortAircraftModel(flight.aircraft.model) : "208 (Caravan)"
            }
            key={`aircraft-${flight?.id ?? "none"}`}
          >
            <option>208 (Caravan)</option>
            <option>1900D (Beech)</option>
          </select>
        </Field>

        <Field label="N-Number">
          <input
            type="text"
            placeholder="N12345"
            defaultValue={flight?.aircraft.tail_number ?? ""}
            key={`tail-${flight?.id ?? "none"}`}
            className="ff-input"
            autoComplete="off"
          />
        </Field>

        <PicPicker options={picOptions} currentPicId={currentPicId} />

        <Field label="SIC Name">
          <input
            type="text"
            placeholder="Last, First (optional)"
            className="ff-input"
            autoComplete="off"
          />
        </Field>

        <Field label="Area Forecast Region">
          <select className="ff-input">
            {/* FAA Area Forecast Discussion regions covering AK ops. Codes
                match legacy peregrineflight; "Southeast Alaska (fallback)"
                is the legacy catch-all when no other region claims the
                routing. */}
            <option>Southwest AK &amp; Eastern Aleutians (FAAK58)</option>
            <option>Southcentral Alaska (FAAK48)</option>
            <option>Bering Sea &amp; Western Aleutians (FAAK68)</option>
            <option>Interior Alaska (FAAK49)</option>
            <option>Northern Alaska (FAAK59)</option>
            <option>E Gulf Coast &amp; SE Coastal Waters (FAAK57)</option>
            <option>Southeast Alaska (fallback)</option>
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
      <label className="mb-1.5 block whitespace-nowrap text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
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
