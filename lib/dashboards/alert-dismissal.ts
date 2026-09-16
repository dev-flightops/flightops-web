/**
 * Whether a dismissal covers an alert.
 *
 * Its own module, with no server imports, because
 * `unacknowledged-alerts.ts` reaches `lib/api/ops` and therefore
 * next-auth, which cannot load under vitest. The rule below is the
 * part worth testing, so it lives where a test can reach it.
 *
 * THE RULE, AND WHY IT IS NOT A SET OF KEYS
 *
 * Alert ids are stable per underlying record — `grounded-<aircraft_id>`
 * — which is what makes them dismissable and also a trap. Ground an
 * aircraft, dismiss the alert, return it to service, ground it again,
 * and the id is identical; a `Set` of dismissed ids would swallow the
 * second grounding for as long as the row survived.
 *
 * So a dismissal covers an occurrence. An alert stays hidden only
 * while the dismissal is at or after the alert's own onset.
 */

/** Just the fields the rule reads, so this module imports nothing. */
export interface DismissalLike {
  occurrence_at: string;
}

export interface DismissableAlert {
  id: string;
  occurredAt: string;
}

export function isDismissed(
  alert: DismissableAlert,
  dismissals: Map<string, DismissalLike>,
): boolean {
  const dismissal = dismissals.get(alert.id);
  if (!dismissal) return false;
  return (
    new Date(dismissal.occurrence_at).getTime() >=
    new Date(alert.occurredAt).getTime()
  );
}


export interface DismissalOutcome<T> {
  alerts: T[];
  /** Hidden by this user's own dismissals. Shown as "N dismissed" so
   *  the bell never looks empty when it is merely filtered — an empty
   *  bell and a cleared bell are different states. */
  dismissedCount: number;
  /** True when the dismissal list could not be read, so the caller can
   *  say the view is unfiltered rather than implying nothing is
   *  outstanding. */
  filterUnavailable: boolean;
}

/**
 * Apply a user's dismissals to a list of alerts.
 *
 * `null` dismissals means they could not be read, and the answer is
 * then EVERY alert rather than none.
 *
 * That direction is the point. Failing towards "you have things to
 * look at" costs a dismissed alert reappearing; failing the other way
 * shows an operator a clear bell while an aircraft is grounded. A
 * mutation that returned an empty list here passed every test in this
 * repo, which is why the behaviour is a function with a test rather
 * than a comment in a fetch wrapper.
 */
export function applyDismissals<T extends DismissableAlert>(
  alerts: T[],
  dismissals: Map<string, DismissalLike> | null,
): DismissalOutcome<T> {
  if (dismissals === null) {
    return { alerts, dismissedCount: 0, filterUnavailable: true };
  }
  const visible = alerts.filter((a) => !isDismissed(a, dismissals));
  return {
    alerts: visible,
    dismissedCount: alerts.length - visible.length,
    filterUnavailable: false,
  };
}
