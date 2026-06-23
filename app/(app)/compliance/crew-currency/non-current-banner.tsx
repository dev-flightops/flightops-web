/**
 * Undismissable red banner — Spec 5 §"Non-current alert banner":
 *   "If ANY pilot is non-current — permanent red banner at the very
 *    top: X pilot(s) are non-current and cannot fly Part 135.
 *    Cannot be dismissed."
 *
 * Intentionally NOT a dismissible toast. The CP needs to see this
 * every time they load the board until all pilots are current.
 */
export function NonCurrentBanner({ count }: { count: number }) {
  const noun = count === 1 ? "pilot is" : "pilots are";
  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-status-red/40 bg-status-red/10 px-4 py-3"
    >
      <p className="text-sm font-semibold text-status-red">
        {count} {noun} non-current and cannot fly Part 135.
      </p>
      <p className="mt-1 text-xs text-status-red/80">
        Filter by NON-CURRENT below to see who needs attention.
      </p>
    </div>
  );
}
