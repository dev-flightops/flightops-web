import { cn } from "@/lib/utils";

/**
 * ForeFlight's controls (#78), as class sets so links, buttons and toggles
 * share them. From their site: a bordered segmented group with the current
 * segment filled, UPPERCASE tracked labels, near-square corners (3px), and
 * buttons that are solid or outlined — never pills.
 */

/** The group: one border around every segment. */
export const segmentGroup = "inline-flex items-stretch overflow-hidden rounded-md border border-input";

/** One segment; `active` fills it with the brand. */
export function segment(active: boolean): string {
  return cn(
    "inline-flex items-center px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.1em] transition-colors",
    "border-l border-input first:border-l-0",
    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );
}

/** Solid action: brand fill, white UPPERCASE label. */
export const buttonSolid = cn(
  "btn-caps inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors",
  "hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60",
);

/** Outlined action: a 1px border in the input tone, the label in full colour. */
export const buttonOutline = cn(
  "btn-caps inline-flex items-center justify-center gap-2 rounded-md border border-input px-4 py-2 text-foreground transition-colors",
  "hover:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60",
);

/** A text link in ForeFlight's idiom: UPPERCASE, tracked, the brand's text tone. */
export const linkCaps =
  "inline-flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary hover:underline underline-offset-4";

/** A page's own tabs (#79), in the department nav's idiom: words, the
 *  current one in the text colour with a 2px rule under it in the brand's
 *  text tone. For switching sections of one page; filters and views use
 *  `segment`. */
export const tabList = "flex flex-wrap items-stretch gap-x-6 border-b border-border";

export function tab(active: boolean): string {
  return cn(
    "relative inline-flex items-center py-2.5 text-[0.8125rem] font-semibold transition-colors",
    "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5",
    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
    active ? "text-foreground after:bg-brand-ink" : "text-muted-foreground hover:text-foreground",
  );
}
