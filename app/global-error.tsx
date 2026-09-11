"use client";

/**
 * Last-resort error boundary. Catches what nothing else can: a throw
 * from the root layout, or from `(app)/layout.tsx`.
 *
 * WHY THIS IS NOT REDUNDANT WITH (app)/error.tsx
 *
 * An error.tsx catches its children, never its own level. So a throw
 * inside (app)/layout.tsx — which is where every authenticated page
 * loads the tenant list — skips (app)/error.tsx entirely and lands
 * here. That is not hypothetical: the layout soft-fails the company
 * profile and the duty pill, but `listMyTenants()` rethrows anything
 * that is not a SessionExpiredError. Auth-service down, gateway 502,
 * DNS blip: all 145 pages, at once, with no boundary above them.
 * Without this file, that renders Next's own unstyled error page.
 *
 * WHY INLINE STYLES, NOT TAILWIND
 *
 * global-error replaces the root layout, and globals.css is imported
 * *by* the root layout. The class names would still be emitted but the
 * stylesheet backing them is not guaranteed to be there — so a
 * Tailwind-styled version of this screen risks rendering as unstyled
 * black-on-white text in exactly the situation it exists for. Hex
 * values below are the resolved dark-theme tokens from globals.css
 * (--background, --foreground, --brand-primary, --destructive); the
 * root layout hardcodes `dark`, so there is one palette to match.
 *
 * It also cannot use <Button>, ErrorScreen, or anything that reaches
 * for router context: there is no layout mounted around it. A plain
 * location.reload() is the only recovery available here, and it is the
 * right one — the failure is upstream of this page, so re-rendering
 * the subtree (what `reset` does) would just throw again.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080c12",
          color: "#e1e8ef",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "2rem 1rem",
        }}
      >
        <main style={{ maxWidth: "30rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#8b98a9",
            }}
          >
            Peregrine Flight Ops
          </p>
          <h1
            style={{
              margin: "0.75rem 0 0",
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            The app could not start
          </h1>
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#8b98a9",
            }}
          >
            Something failed before the page could load, so this is all we
            can show. It is usually a brief connection problem — reloading
            often clears it. If it does not, the operations team should be
            told the system is unreachable.
          </p>

          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 0,
                borderRadius: "0.375rem",
                background: "#0a84ff",
                color: "#fff",
                padding: "0.55rem 1.1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            {/* Not a full page load, so it keeps whatever session is
                still good — worth offering even though the cause is
                usually upstream. Anchor, not <Link>: no router here. */}
            <a
              href="/login"
              style={{
                borderRadius: "0.375rem",
                border: "1px solid #1e2836",
                color: "#e1e8ef",
                padding: "0.55rem 1.1rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in again
            </a>
          </div>

          {/* `reset` is in the props Next passes and re-renders the
              subtree. Kept reachable rather than dropped: if the throw
              happened to be transient render state and not the gateway,
              this is the cheap recovery. Deliberately the quiet option,
              because it is the less likely fix of the two. */}
          <p style={{ marginTop: "1.25rem", fontSize: "0.75rem" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: 0,
                background: "none",
                padding: 0,
                color: "#8b98a9",
                fontSize: "0.75rem",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Try rendering again
            </button>
          </p>

          {error.digest && (
            <p
              style={{
                marginTop: "1.5rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                color: "#8b98a9",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
