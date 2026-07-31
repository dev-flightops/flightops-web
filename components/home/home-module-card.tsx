import Link from "next/link";

import { cn } from "@/lib/utils";

import { type HomeModule, moduleStatusHint } from "./module-catalog";

/** Home-page module tile — pitch-skin card/nav-item pattern.
 *
 *    - White surface, thin neutral border, generous padding
 *    - Red LEFT-BORDER STRIPE on highlighted cards (active-tab treatment)
 *    - Chevron > arrow on the right — always visible for live cards
 *    - Hover: red border ring + tiny shadow, no lift so the layout
 *      stays rock-solid during pointer movement
 *
 *  Unbuilt cards get a small "M3" / "M4" chip and 70% opacity so the
 *  future roadmap reads cleanly on the pitch. */
export function HomeModuleCard({ module }: { module: HomeModule }) {
  const isLive = module.status === "live";
  const hint = moduleStatusHint(module.status);

  const wrapperClass = cn(
    "group relative flex items-center gap-4 rounded-xl border bg-white p-5 pl-6 transition-all",
    isLive
      ? "cursor-pointer border-black/10 hover:border-[#AB2429] hover:shadow-[0_6px_20px_-12px_rgba(171,36,41,0.5)]"
      : "cursor-not-allowed border-black/[0.08] opacity-70",
    // Highlighted cards get a solid red left-stripe (4px) like Grant's
    // active-tab treatment. Using pl-6 above so the stripe replaces
    // the padding cleanly.
    module.highlight && "border-l-4 border-l-[#AB2429] pl-5",
  );

  const content = (
    <>
      {/* Icon tile — 44px, brand tint */}
      <span
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
        style={{ backgroundColor: `${module.color}1a` }}
        aria-hidden
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={module.color}
        >
          <path d={module.iconPath} />
        </svg>
      </span>

      {/* Label + sub — takes remaining space */}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[0.95rem] font-semibold leading-tight",
            module.highlight ? "text-[#AB2429]" : "text-neutral-900",
          )}
        >
          {module.label}
        </div>
        <div className="mt-0.5 text-[0.72rem] leading-snug text-neutral-500">
          {module.sub}
        </div>
      </div>

      {/* Right-side affordance: M3/M4 chip for unbuilt, chevron for live */}
      {isLive ? (
        <span
          className="flex-shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#AB2429]"
          aria-hidden
        >
          <ChevronRight />
        </span>
      ) : (
        <span className="flex-shrink-0 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-neutral-500">
          {module.status.toUpperCase()}
        </span>
      )}
    </>
  );

  if (isLive) {
    return (
      <Link
        href={module.href}
        className={wrapperClass}
        data-testid={`home-mod-card-${module.id}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={wrapperClass}
      role="link"
      aria-disabled="true"
      title={hint ?? undefined}
      data-testid={`home-mod-card-${module.id}`}
    >
      {content}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
