import type { FlightDetail } from "@/lib/api/types";

import { PicPicker, type PicOption } from "./pic-picker";
import { SectionPanel } from "./section-panel";

/**
 * The operator's own shorthand for an airframe, from legacy
 * `modules/dispatch/weather.py`:
 *
 *     AIRCRAFT_CHOICES = ("207", "208 (Caravan)", "GA8", "PA31",
 *                         "King Air")
 *
 * Ported as two of the five, which is the bug the client found on
 * 24 September: a flight assigned N806PA — a Cessna 207 — showed
 * "208 (Caravan)". `shortAircraftModel` returned the raw model string
 * for anything outside those two, no <option> matched it, and a browser
 * with no matching option renders the first one. Four of the eight
 * models in the fleet displayed a materially wrong type that way, and
 * two more an imprecise one.
 *
 * "1900D (Beech)" is ours rather than legacy's; the fleet has one and
 * it would otherwise fall through.
 */
const AIRCRAFT_LABELS = [
  "207",
  "208 (Caravan)",
  "GA8",
  "PA31",
  "King Air",
  "1900D (Beech)",
] as const;

/**
 * The airframe label for an aircraft.
 *
 * Reads `airframe_type` first, because that is the structured field the
 * rest of the platform scores against — the FRAT's type-currency check
 * uses it — and matching on model strings is how the original went
 * wrong. Model text is the fallback for the one fleet row whose
 * airframe_type is null, and the raw model is the last resort.
 *
 * Returning the raw model rather than a default is the point: an
 * unrecognised airframe shows as itself. Showing the first option
 * instead is what told a dispatcher their 207 was a Caravan.
 */
function airframeLabel(
  airframeType: string | null | undefined,
  model: string | null,
): string {
  switch ((airframeType ?? "").toLowerCase()) {
    case "c207":
      return "207";
    case "caravan":
      return "208 (Caravan)";
    case "ga8":
      return "GA8";
    case "navajo":
      return "PA31";
    case "kingair":
      // The fleet's two king airs are a 1900D and a King Air 200, and
      // the model text is what separates them.
      return model && /1900D/i.test(model) ? "1900D (Beech)" : "King Air";
  }
  if (!model) return "—";
  if (/207/.test(model)) return "207";
  if (/Grand\s+Caravan|208/i.test(model)) return "208 (Caravan)";
  if (/GA8|Airvan/i.test(model)) return "GA8";
  if (/PA-?31|Navajo/i.test(model)) return "PA31";
  if (/1900D/i.test(model)) return "1900D (Beech)";
  if (/King\s+Air/i.test(model)) return "King Air";
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
 *   - Area Forecast Region: a static <select>; nothing submits it yet
 *   - Aircraft: derived from the loaded flight and shown as a value.
 *     A dropdown here previously claimed a choice it did not have —
 *     there is no form, no name attribute and no submit handler on
 *     this panel, so no selection was ever captured.
 *   - PIC / SIC: freeform text; typeahead search ships with crew-service
 *     in M3
 */
export function FlightDetailsPanel({
  flight,
  picOptions,
  currentPicId,
  flightId,
}: {
  flight?: FlightDetail | null;
  /** Pilot roster + overall status for the PIC dropdown (M2-G-5). */
  picOptions: PicOption[];
  /** The PIC in effect — the assigned one where a flight is loaded,
   *  otherwise the ?pic=<uuid> pre-screen selection. */
  currentPicId: string | null;
  /** Flight to assign against. Null on a hand-filled packet, where the
   *  picker stays a pre-screen. */
  flightId?: string | null;
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
          {flight ? (
            /* Fixed, not a dropdown, once a flight is loaded.
               The airframe is whatever the assigned tail is, so there
               is nothing here for a dispatcher to decide — and the
               control captured nothing anyway: no form, no name, no
               submit handler. An editable dropdown that changes
               nothing is worse than a value, because it invites
               exactly the reasoning the client applied to it ("it
               lets you select a caravan"). Swapping the aircraft is a
               change to the flight, not to this packet. */
            <p
              className="ff-input flex items-center justify-between gap-2"
              data-testid="packet-airframe"
            >
              <span>
                {airframeLabel(
                  flight.aircraft.airframe_type,
                  flight.aircraft.model,
                )}
              </span>
              <span className="text-[0.65rem] font-normal text-muted-foreground">
                from {flight.aircraft.tail_number}
              </span>
            </p>
          ) : (
            /* No flight loaded — a hand-filled packet, where the
               dispatcher is telling us what they are flying. All five
               of the operator's airframes, plus the 1900D. */
            <select className="ff-input" defaultValue="208 (Caravan)">
              {AIRCRAFT_LABELS.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          )}
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

        <PicPicker
          options={picOptions}
          currentPicId={currentPicId}
          flightId={flightId}
        />

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
  // `min-w-0` on the grid item lets the label + input respect the
  // column width (grid items default to `min-width: auto` which is
  // content-width; without min-w-0 the label overflows into the
  // neighboring column).
  // Label uses `truncate` (overflow: hidden + ellipsis + nowrap) so
  // long copy like "FLIGHT # (PRESS ENTER TO LOAD)" gets an
  // ellipsis at narrow widths instead of bleeding through.
  // `title` carries the full label + hint so hover reveals what's
  // been truncated.
  const fullTitle = hint ? `${label} (${hint})` : label;
  return (
    <div className="min-w-0">
      <label
        title={fullTitle}
        className="mb-1.5 block truncate text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
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
