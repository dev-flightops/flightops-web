/**
 * The document-state vocabulary, kept apart from `lib/api/*`.
 *
 * `lib/api/employee-documents.ts` reaches `apiFetch`, which begins
 * with `await auth()` — so importing anything from it drags next-auth
 * and `next/server` into jsdom and a component test cannot load. The
 * labels and the needs-action set are display vocabulary with no
 * server dependency, so they live here and the panel imports its types
 * from the API module with `import type`.
 *
 * Same split the repo already makes elsewhere for the same reason; see
 * `lib/api/client-boundary.test.ts` for the guard.
 */

/**
 * The five states the service reports, in the order a reader should be
 * shown them — the ones needing action first.
 *
 * `undated` is the one worth knowing about: a document is on file, the
 * requirement wants an expiry, and none was recorded. That reads as
 * current forever, so it is not `on_file`.
 */
export const DOCUMENT_STATES = [
  "expired",
  "undated",
  "expiring",
  "missing",
  "on_file",
] as const;

export type DocumentState = (typeof DOCUMENT_STATES)[number];

export const DOCUMENT_STATE_LABELS: Record<DocumentState, string> = {
  expired: "Expired",
  undated: "No expiry recorded",
  expiring: "Expiring",
  missing: "Missing",
  on_file: "On file",
};

/** Everything except `on_file` needs somebody to do something. */
export const NEEDS_ACTION: ReadonlySet<DocumentState> = new Set(
  DOCUMENT_STATES.filter((s) => s !== "on_file"),
);

/** Tailwind tokens per state. Semantic colour, and `undated` gets its
 *  own — it is not a milder version of expiring, it is a document
 *  nobody can check. */
export const DOCUMENT_STATE_TOKENS: Record<DocumentState, string> = {
  expired: "border-status-red/40 bg-status-red/10 text-status-red",
  undated: "border-status-orange/40 bg-status-orange/10 text-status-orange",
  expiring: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
  missing: "border-border bg-muted/20 text-muted-foreground",
  on_file: "border-status-green/40 bg-status-green/10 text-status-green",
};

export function isDocumentState(value: string): value is DocumentState {
  return (DOCUMENT_STATES as readonly string[]).includes(value);
}
