import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { linkCaps } from "./controls";

/**
 * Every page's head (#79), as Flight Following set it in #78: ForeFlight's
 * display title in capitals, one plain line under it, the page's actions
 * on the right (outlined for secondary ones, solid for the one primary),
 * and a rule beneath. A detail page adds a way back and a small label for
 * the kind of record it shows.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  back,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** A short label above the title, e.g. the kind of record a detail page shows. */
  eyebrow?: ReactNode;
  /** Where "back" goes from a detail page. */
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className={cn(linkCaps, "mb-3 text-muted-foreground hover:text-foreground")}>
            <span aria-hidden>‹</span> {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="page-title text-balance">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
