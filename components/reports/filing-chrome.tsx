import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <Link
          href="/reports/regulatory"
          className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}
        >
          <span aria-hidden>‹</span> Regulatory
        </Link>
        <h1 className="mt-1 page-title text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {controls}
    </header>
  );
}

/** What the service says the figures are and are not. */
export function FilingAdvisory({ text }: { text: string }) {
  return (
    <p className="mb-4 notice notice-gray text-muted-foreground">
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
      className="mb-4 notice notice-yellow"
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
      className="mb-4 notice notice-yellow"
    >
      {children}
    </p>
  );
}

export function FilingLoadError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="notice notice-red text-sm"
    >
      {message}
    </p>
  );
}

export function FilingEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
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
  "ff-thead";
export const TD = "px-4 py-2.5 text-foreground";
export const TD_NUM = "px-4 py-2.5 text-right tabular-nums text-foreground";
export const TD_MONO = "px-4 py-2.5 font-mono text-foreground";
