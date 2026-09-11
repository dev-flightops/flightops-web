import Link from "next/link";

/**
 * The parts every regulatory filing page repeats.
 *
 * Five pages share a back link, a title, the service's advisory, a
 * draft-manifest warning and one error message. Factored so the pages
 * themselves are their table and nothing else — and so the advisory
 * cannot end up worded differently on one of them.
 */

export function FilingHeader({
  title,
  subtitle,
  controls,
}: {
  title: string;
  subtitle?: React.ReactNode;
  controls?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link
          href="/reports/regulatory"
          className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← Regulatory
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {controls}
    </header>
  );
}

/** What the service says the figures are and are not. */
export function FilingAdvisory({ text }: { text: string }) {
  return (
    <p className="mb-4 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
      {text}
    </p>
  );
}

/**
 * Drafts are excluded from every mail figure, and the service counts
 * them so the page can say so. A filing compiled from records that can
 * still change ought to announce that before it is filed, not after.
 */
export function DraftManifestWarning({ count }: { count: number }) {
  if (count <= 0) return null;
  const one = count === 1;
  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-status-yellow/30 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
    >
      {count} manifest{one ? " is" : "s are"} still in draft for this period and{" "}
      {one ? "its" : "their"} mail is not counted below. Lock{" "}
      {one ? "it" : "them"} before filing.
    </p>
  );
}

/**
 * Counts of things the report could not measure, stated rather than
 * folded into a figure. The colour is deliberate: these read as
 * warnings, not as ordinary context, because a filing that silently
 * scored an unmeasured flight as a pass is the failure being guarded
 * against.
 */
export function NotMeasuredNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mb-4 rounded-md border border-status-yellow/30 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
    >
      {children}
    </p>
  );
}

export function FilingLoadError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
    >
      {message}
    </p>
  );
}

export function FilingEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-16 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** A percentage that may not exist. Blank, never 0%. */
export function Pct({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span
        className="text-muted-foreground"
        title="Nothing here could be measured, so there is no percentage to report"
      >
        —
      </span>
    );
  }
  return <>{value.toFixed(1)}%</>;
}

/** Shared table shell: horizontal scroll on its own container, so the
 *  page body never scrolls sideways on a narrow screen. */
export function FilingTable({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const TH_CLASS =
  "border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";
export const TD = "px-4 py-2.5 text-foreground";
export const TD_NUM = "px-4 py-2.5 text-right tabular-nums text-foreground";
export const TD_MONO = "px-4 py-2.5 font-mono text-foreground";
