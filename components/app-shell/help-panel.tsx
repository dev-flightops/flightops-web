"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DEPARTMENTS } from "@/components/app-shell/modules";
import { formatRole } from "@/lib/roles";
import {
  HELP_ENTRIES,
  helpFor,
  searchHelp,
  type HelpEntry,
} from "@/lib/help/catalogue";

/**
 * The `?` in the top bar. Was a disabled "Coming in M4" placeholder.
 *
 * Legacy's is a slide-out with three tabs — My Guide, Features, Data
 * Flow — over fifty hand-written feature articles, plus an admin CRUD
 * with version history and per-company overrides.
 *
 * This is the first slice: contextual help for the page you are on,
 * and a search across everything written so far. What is deliberately
 * not here:
 *
 *   Data Flow diagrams. Legacy's are hand-drawn descriptions of how
 *   its data moves, and ours moves differently — they would be wrong
 *   rather than merely missing.
 *
 *   Editable articles with version history and per-operator
 *   overrides. That is a content-management feature, and it is worth
 *   having only once there is enough content to be worth an operator
 *   editing. Fourteen articles is not that yet.
 *
 * WHY IT OPENS ON THE CURRENT PAGE
 *
 * The question somebody presses `?` to ask is almost always about what
 * is in front of them. Legacy opens on a general guide and makes you
 * navigate; this opens on the article for the route you are on, and
 * falls back to search when there is not one.
 *
 * WHEN THERE IS NO ARTICLE IT SAYS SO
 *
 * Naming the route and offering the search rather than rendering an
 * empty panel or a generic paragraph. Fourteen routes have articles
 * out of roughly ninety modules, and a help system that pretends
 * otherwise is worse than one that admits it.
 */

/** Nav labels by href, so a related link can be named without a
 *  second copy of the name. */
const NAV_LABELS = new Map(
  DEPARTMENTS.flatMap((d) => d.children)
    .filter((c) => c.href)
    .map((c) => [c.href as string, c.label]),
);

function labelFor(route: string): string {
  const article = HELP_ENTRIES.find((e) => e.route === route);
  if (article) return article.title;
  return NAV_LABELS.get(route) ?? route;
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <h3 className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {heading}
      </h3>
      {children}
    </section>
  );
}

function Article({
  entry,
  onNavigate,
}: {
  entry: HelpEntry;
  onNavigate: () => void;
}) {
  // A related route does not need an article of its own — these are
  // navigation, and landing on the Weather page is useful whether or
  // not somebody has written about it yet. Filtering to articled
  // routes silently dropped twelve of these, which is how a "Related"
  // section ends up rendering nothing.
  //
  // The label comes from the article if there is one, then from the
  // module registry — the same names the nav shows — rather than from
  // a third hand-written copy.
  const related = (entry.related ?? []).map((route) => ({
    route,
    label: labelFor(route),
  }));

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold">{entry.title}</h2>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {entry.whatItDoes}
      </p>

      <Section heading="How to use it">
        <ol className="space-y-1.5">
          {entry.howToUse.map((step, i) => (
            <li key={step} className="flex gap-2 text-xs text-muted-foreground">
              <span className="shrink-0 font-semibold text-foreground">
                {i + 1}.
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* Deep-dive sections. Legacy calls these `extras` and uses them
          for the things a paragraph cannot carry: what each MEL
          category obliges, how a scoring band is built, a tab-by-tab
          walkthrough. */}
      {entry.sections?.map((section) => (
        <Section key={section.heading} heading={section.heading}>
          {section.body && (
            <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          )}
          {section.steps && section.steps.length > 0 && (
            <ul className="space-y-1.5">
              {section.steps.map((step) => (
                <li
                  key={step}
                  className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                >
                  <span aria-hidden className="shrink-0 text-muted-foreground/60">
                    •
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      {entry.connectsTo && (
        <Section heading="Where the numbers come from">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {entry.connectsTo}
          </p>
        </Section>
      )}

      {entry.worthKnowing && entry.worthKnowing.length > 0 && (
        <Section heading="Worth knowing">
          <ul className="space-y-1.5">
            {entry.worthKnowing.map((note) => (
              <li
                key={note}
                className="border-l-2 border-primary/40 pl-2 text-xs leading-relaxed text-muted-foreground"
              >
                {note}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* One concrete situation. These are the most useful part of
          legacy's articles — an operator recognises their own Tuesday
          in one faster than they parse a feature description. */}
      {entry.example && (
        <Section heading="For example">
          <p className="border-l-2 border-primary/40 pl-2 text-xs leading-relaxed text-muted-foreground">
            {entry.example}
          </p>
        </Section>
      )}

      {entry.whoCanUse && entry.whoCanUse.length > 0 && (
        <Section heading="Written for">
          {/* Descriptive, not a gate — the page's own server-side check
              decides access. This says whether the article is aimed at
              the reader. */}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {entry.whoCanUse.map(formatRole).join(", ")}
          </p>
        </Section>
      )}

      {related.length > 0 && (
        <Section heading="Related">
          <ul className="space-y-1">
            {related.map((r) => (
              <li key={r.route}>
                <Link
                  href={r.route}
                  onClick={onNavigate}
                  className="text-xs text-primary hover:underline"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export function HelpPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const contextual = useMemo(() => helpFor(pathname ?? "/"), [pathname]);
  const results = useMemo(() => searchHelp(query), [query]);
  const searching = query.trim().length >= 2;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      // Two refs, because the dialog is portalled out of this
      // component's DOM position and is therefore NOT inside the
      // button's wrapper. Checking only the wrapper would treat every
      // click inside the panel — including into the search box — as a
      // click outside, and close it.
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        dialogRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // A route change while the panel is open means the reader followed a
  // link out of it. Close, rather than leaving a panel about the page
  // they just left.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div ref={buttonRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Help"
        title={contextual ? `Help — ${contextual.title}` : "Help"}
        className="hidden items-center rounded-md p-2 text-muted-foreground hover:bg-foreground/8 hover:text-foreground sm:inline-flex"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
        </svg>
      </button>

      {/* PORTALLED, AND NOT AS A TIDINESS CHOICE
       *
       * The app shell's header is `sticky ... bg-muted/95 backdrop-blur`,
       * and `backdrop-filter` makes an element a containing block for
       * its fixed-position descendants. Rendered in place, this drawer's
       * `fixed` + `h-full` resolved against the 84px header instead of
       * the viewport, so it opened as an 83px-tall strip with the
       * article clipped out of sight — on every page except /home,
       * which renders its own HeaderActions outside that header and so
       * looked fine.
       *
       * A portal to document.body puts it back in the initial
       * containing block. Sizing it with viewport units instead would
       * have fixed the height while leaving the drawer positioned
       * against the header, which is only coincidentally the right
       * place and breaks the moment the header gains an offset.
       */}
      {open &&
        createPortal(
          <div
            ref={dialogRef}
            role="dialog"
            aria-label="Help"
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-card shadow-xl sm:w-[26rem]"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold">Help</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="border-b border-border px-4 py-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search help"
                aria-label="Search help"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {searching ? (
                results.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing written about &ldquo;{query.trim()}&rdquo; yet.{" "}
                    {HELP_ENTRIES.length} pages have articles so far.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {results.map((entry) => (
                      <li
                        key={entry.route}
                        data-testid={`help-result-${entry.route}`}
                      >
                        <Link
                          href={entry.route}
                          onClick={() => setOpen(false)}
                          className="text-xs font-semibold hover:text-primary"
                        >
                          {entry.title}
                        </Link>
                        <p className="mt-0.5 text-[0.68rem] leading-relaxed text-muted-foreground">
                          {entry.whatItDoes}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : contextual ? (
                <div data-testid={`help-article-${contextual.route}`}>
                  <Article
                    entry={contextual}
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              ) : (
                <div data-testid="help-no-article">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    No help written for{" "}
                    <span className="font-mono text-foreground">
                      {pathname}
                    </span>{" "}
                    yet. {HELP_ENTRIES.length} pages have articles so far —
                    search above, or start from one of these.
                  </p>
                  <ul className="mt-3 space-y-1">
                    {HELP_ENTRIES.map((entry) => (
                      <li key={entry.route}>
                        <Link
                          href={entry.route}
                          onClick={() => setOpen(false)}
                          className="text-xs text-primary hover:underline"
                        >
                          {entry.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
