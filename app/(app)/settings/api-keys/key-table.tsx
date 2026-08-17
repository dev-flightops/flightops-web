import type { ApiKeyRow } from "@/lib/api/api-keys";

/**
 * The key list, with no hooks and no action wiring.
 *
 * Split out from KeyManager so it can actually be unit-tested: this
 * project runs React 18 under vitest, which cannot render a component
 * using useActionState (the repo's other action components are mocked
 * to null in tests for that reason). Everything worth asserting about
 * the list — status derivation, the never-used case, which rows offer
 * Revoke — lives here instead of behind that wall.
 *
 * The revoke control is injected as a render prop so this file stays
 * free of server-action imports.
 */
export function KeyTable({
  keys,
  renderRevoke,
}: {
  keys: ApiKeyRow[];
  renderRevoke?: (key: ApiKeyRow) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.06em] text-muted-foreground">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Key</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Last used</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {keys.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-6 text-center text-muted-foreground"
              >
                No API keys yet.
              </td>
            </tr>
          ) : (
            keys.map((k) => (
              <tr key={k.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 text-foreground">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {k.key_prefix}…
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatWhen(k.created_at)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {/* "Never" is actionable: a key nobody has used is one
                      you can probably revoke. */}
                  {k.last_used_at ? formatWhen(k.last_used_at) : "Never"}
                </td>
                <td className="px-4 py-3">
                  <KeyStatus row={k} />
                </td>
                <td className="px-4 py-3 text-right">
                  {k.is_active && renderRevoke ? renderRevoke(k) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Revoked and expired are deliberately distinct.
 *
 * Revoked means a person acted; expired means the clock ran out. When
 * auditing who still has access, "someone turned this off" and "this
 * lapsed" call for different follow-ups, so the UI should not collapse
 * them into one "inactive".
 */
export function KeyStatus({ row }: { row: ApiKeyRow }) {
  const base =
    "inline-flex rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em]";
  if (row.revoked_at) {
    return (
      <span className={`${base} bg-status-red/15 text-status-red`}>Revoked</span>
    );
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return (
      <span className={`${base} bg-muted/40 text-muted-foreground`}>Expired</span>
    );
  }
  return (
    <span className={`${base} bg-status-green/15 text-status-green`}>Active</span>
  );
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
