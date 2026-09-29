/**
 * The dispatch packet keeps its working state in the URL: the PIC, the
 * route, and every acknowledgment (NOTAMs, MELs, soft warnings, stale
 * weather, the supervisor override). Each control built its next URL
 * from useSearchParams(), which is the URL the server last rendered,
 * not the one a click a moment earlier is still loading. Tick a soft
 * warning and then a NOTAM before the page came back, and the NOTAM's
 * URL carried no trace of the soft warning: the first tick vanished.
 * Found walking the 27 Sep fixes, where the SIC acknowledgment went
 * that way and Release dispatch then waited on it.
 *
 * So every change builds on the newest URL any control has asked for,
 * while the page is still on its way there: the URL it shows is one of
 * the steps. Anything else, a different flight picked or the back
 * button, starts again from what the page shows.
 *
 * Plain module state, no React: it only runs in event handlers, and a
 * tab has one packet. See use-dispatch-query.ts for the hook.
 */

let steps = new Set<string>();
let newest: string | null = null;

/** The next query string: `change` applied to the newest one asked for. */
export function nextDispatchQuery(
  shown: string,
  change: (params: URLSearchParams) => void,
): string {
  if (newest === null || !steps.has(shown)) {
    steps = new Set([shown]);
    newest = shown;
  }
  const params = new URLSearchParams(newest);
  change(params);
  newest = params.toString();
  steps.add(newest);
  return newest;
}

/**
 * The page now shows `shown`. Once that is the newest URL asked for,
 * the steps before it are history: going back to one of them is a
 * navigation of its own, not a page still loading.
 */
export function settleDispatchQuery(shown: string): void {
  if (shown === newest) steps = new Set([shown]);
}

/** Tests render one packet after another in the same module. */
export function resetDispatchQuery(): void {
  steps = new Set();
  newest = null;
}
