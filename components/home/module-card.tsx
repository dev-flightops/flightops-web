import Link from "next/link";

import { cn } from "@/lib/utils";

import { type HomeModule, moduleStatusHint } from "./module-catalog";

/**
 * One tile in the home page module grid. Pixel-match for the legacy
 * `.mod-card` from `dispatch-platform-main/templates/home.html`:
 *
 *   - 12px corner radius
 *   - panel background
 *   - 38×38 colored icon tile on the left
 *   - label (foreground) + sub (muted) stacked on the right
 *   - hover lifts the card 1px and tints the border the same blue as the
 *     legacy `rgba(10,132,255,.3)`
 *
 * Disabled modules render as <div> with aria-disabled + a `title` tooltip
 * ("Coming in M2/M3/M4") and never navigate.
 */
export function ModuleCard({ module }: { module: HomeModule }) {
  const isLive = module.status === "live";
  const hint = moduleStatusHint(module.status);

  const className = cn(
    "flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all",
    isLive
      ? "hover:-translate-y-px hover:border-primary/30 cursor-pointer"
      : "opacity-60 cursor-not-allowed",
    // Highlighted modules (Flight Crew, Fleet Brain in the legacy) get a
    // blue-tinted border + faint blue background.
    module.highlight &&
      "border-primary/30 bg-primary/[0.04]",
  );

  const content = (
    <>
      <span
        className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[9px]"
        style={{ backgroundColor: `${module.color}1f` }}
        aria-hidden
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={module.color}
        >
          <path d={module.iconPath} />
        </svg>
      </span>
      <div className="min-w-0">
        <div
          className={cn(
            "text-[0.82rem] font-semibold",
            module.highlight ? "text-status-blue" : "text-foreground",
          )}
        >
          {module.label}
        </div>
        <div className="mt-px text-[0.65rem] leading-snug text-muted-foreground">
          {module.sub}
        </div>
      </div>
    </>
  );

  if (isLive) {
    return (
      <Link
        href={module.href}
        className={className}
        data-testid={`mod-card-${module.id}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={className}
      role="link"
      aria-disabled="true"
      title={hint ?? undefined}
      data-testid={`mod-card-${module.id}`}
    >
      {content}
    </div>
  );
}
