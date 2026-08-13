import Link from "next/link";

/**
 * Global 404 — branded replacement for Next's default "This page could
 * not be found." Rendered for any unmatched route or an explicit
 * notFound() (e.g. a guarded resource in another tenant, info-hide).
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Peregrine Flight Ops
      </p>
      <h1 className="mt-2 text-5xl font-bold tracking-tight text-foreground">
        404
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        We couldn&rsquo;t find that page. It may have moved, or you may not
        have access to it.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/home"
          className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark"
        >
          Back to home
        </Link>
        <Link
          href="/dispatch"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/20"
        >
          Go to Dispatch
        </Link>
      </div>
    </div>
  );
}
