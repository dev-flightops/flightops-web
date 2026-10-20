import Link from "next/link";

/**
 * Global 404 — branded replacement for Next's default "This page could
 * not be found." Rendered for any unmatched route or an explicit
 * notFound() (e.g. a guarded resource in another tenant, info-hide).
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">
        Peregrine Flight Ops
      </p>
      <h1 className="mt-2 font-display text-7xl font-extrabold leading-none text-foreground">
        404
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        We couldn&rsquo;t find that page. It may have moved, or you may not
        have access to it.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/home"
          className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark"
        >
          Back to home
        </Link>
        <Link
          href="/dispatch"
          className="btn-caps rounded-md border border-input px-4 py-2 text-foreground hover:bg-accent"
        >
          Go to Dispatch
        </Link>
      </div>
    </div>
  );
}
