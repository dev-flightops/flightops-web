/**
 * The aircraft's type as the rest of the app reads it: the e-log's trend
 * form, the fuel it takes and the dispatch packet's airframe. The fleet
 * dialogs asked for an "Airframe slug" in a free-text box (11 Nov), so a
 * typo left the trend tab saying the type wasn't set up.
 */
export const AIRFRAME_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "caravan", label: "Cessna 208 Caravan" },
  { value: "c207", label: "Cessna 207" },
  { value: "c182", label: "Cessna 182" },
  { value: "ga8", label: "GippsAero GA8 Airvan" },
  { value: "navajo", label: "Piper PA-31 Navajo" },
  { value: "kingair", label: "Beechcraft King Air" },
  { value: "1900d", label: "Beechcraft 1900D" },
  { value: "pilatus", label: "Pilatus PC-12" },
];

export function AirframeTypeSelect({
  defaultValue = "",
  optional = false,
  error,
}: {
  defaultValue?: string;
  optional?: boolean;
  error?: string;
}) {
  // A type entered before the list (or one it doesn't know) stays as it is.
  const other = defaultValue && !AIRFRAME_TYPES.some((t) => t.value === defaultValue) ? defaultValue : null;
  return (
    <div>
      <label htmlFor="airframe_type" className="field-label">
        {optional ? "Airframe type (optional)" : "Airframe type"}
      </label>
      <select
        id="airframe_type"
        name="airframe_type"
        defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined}
        className="ff-input px-3 py-2 text-sm aria-[invalid=true]:border-status-red"
      >
        <option value="">Not set</option>
        {other ? <option value={other}>{other}</option> : null}
        {AIRFRAME_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
