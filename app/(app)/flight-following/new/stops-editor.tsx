"use client";

import type { SubmittedStop } from "./actions";

/**
 * The legs after the first, on "Open New Flight".
 *
 * The client, 27 Sep: "when dispatch is building a flight. It appears
 * there is not a way to build a multi leg route." Legacy built one as
 * stops added to a flight, each leg departing where the one before it
 * landed; that is what each row here is. The flight keeps one packet
 * and one release for the whole route.
 *
 * Controlled, so the rows survive a failed submit: the form echoes
 * them back and remounts this with them.
 */
export function StopsEditor({
  stops,
  onChange,
  firstDestination,
  errors,
}: {
  stops: SubmittedStop[];
  onChange: (stops: SubmittedStop[]) => void;
  /** Leg 1's destination, as typed, for the second leg's "from". */
  firstDestination: string;
  errors: Record<string, string>;
}) {
  const set = (i: number, patch: Partial<SubmittedStop>) =>
    onChange(stops.map((s, n) => (n === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      {stops.map((stop, i) => {
        const from = (i === 0 ? firstDestination : stops[i - 1].destination) || "the previous stop";
        return (
          <fieldset
            key={i}
            className="rounded-md border border-border p-3"
            aria-label={`Leg ${i + 2}`}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Leg {i + 2} · from <span className="font-mono">{from}</span>
              </p>
              <button
                type="button"
                onClick={() => onChange(stops.filter((_, n) => n !== i))}
                className="text-[0.65rem] font-semibold text-muted-foreground hover:text-status-red"
              >
                Remove
                <span className="sr-only"> leg {i + 2}</span>
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <StopField
                id={`stop-${i}-destination`}
                name="stop_destination"
                label="Destination ICAO"
                value={stop.destination}
                onChange={(v) => set(i, { destination: v.toUpperCase() })}
                error={errors[`stop_${i}_destination`]}
                maxLength={4}
                placeholder="PASM"
              />
              <StopField
                id={`stop-${i}-departure`}
                name="stop_departure"
                label="ETD (UTC)"
                type="datetime-local"
                value={stop.departure}
                onChange={(v) => set(i, { departure: v })}
                error={errors[`stop_${i}_departure`]}
              />
              <StopField
                id={`stop-${i}-arrival`}
                name="stop_arrival"
                label="ETA (UTC)"
                type="datetime-local"
                value={stop.arrival}
                onChange={(v) => set(i, { arrival: v })}
                error={errors[`stop_${i}_arrival`]}
              />
            </div>
          </fieldset>
        );
      })}
      {errors.stops && (
        <p role="alert" className="text-[0.65rem] text-status-red">
          {errors.stops}
        </p>
      )}
      <button
        type="button"
        onClick={() => onChange([...stops, { destination: "", departure: "", arrival: "" }])}
        className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
      >
        + Add stop
      </button>
    </div>
  );
}

function StopField({
  id,
  name,
  label,
  value,
  onChange,
  error,
  type = "text",
  maxLength,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        <span className="text-status-red"> *</span>
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoCapitalize={type === "text" ? "characters" : undefined}
        spellCheck={type === "text" ? false : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
