"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  canSeeDepartment,
  departmentForPath,
  moduleStatusHint,
  visibleModules,
  type ModuleEntry,
} from "./modules";

/**
 * Second-row department-context nav. Renders nothing when the current path
 * isn't under any department (e.g. the home page or login).
 *
 * Pattern is borrowed from the legacy dispatch-platform's department row:
 * a leading Home breadcrumb chevron, then the sibling modules of the
 * department the user is currently inside.
 *
 * ForeFlight's tabs (#78): plain labels, the current one in full colour
 * with a 2px underline in the brand's text tone — no filled pills.
 */
export function DepartmentNav({ roles = [] }: { roles?: readonly string[] }) {
  const pathname = usePathname() ?? "/";
  const dept = departmentForPath(pathname);
  if (!dept) return null;
  // A user who reached a department they shouldn't see gets no sibling
  // nav rather than a filtered one — the page itself is the backend's
  // problem, but we should not offer to take them further in.
  if (!canSeeDepartment(dept, roles)) return null;

  const modules = visibleModules(dept, roles);
  if (modules.length === 0) return null;
  // Found among all the department's modules, not just the visible
  // ones. On a page this role cannot see (opened by URL), the visible
  // chip with the longest matching prefix is not where they are: a
  // dispatcher on /reservations/accounting-export would see New Booking
  // (/reservations) lit. Then no chip is current.
  const activeId = activeModuleId(dept.children, pathname);
  // The modules from the first divider on (Admin's AI tools) wrap as one
  // group (#102): left to wrap alone, Fleet Brain ended line one and the
  // rest of the group began line two. From md up it keeps the right
  // end of its line, so its divider still reads as one.
  const split = modules.findIndex((m, i) => i > 0 && m.dividerBefore);
  const head = split > 0 ? modules.slice(0, split) : modules;
  const tail = split > 0 ? modules.slice(split) : [];
  const item = (module: ModuleEntry) => (
    <DepartmentNavItem key={module.id} module={module} isActive={module.id === activeId} />
  );

  return (
    <div className="border-b border-border bg-background">
      <div className="container flex min-h-11 items-stretch gap-2 px-3">
        <Link
          href="/home/"
          className="flex flex-shrink-0 items-center px-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Home"
        >
          <HomeGlyph />
        </Link>
        <span className="flex items-center text-muted-foreground" aria-hidden>
          <ChevronGlyph />
        </span>

        {/* h-scroll on phones instead of wrapping or clipping: one line
            the user swipes across. From md up the row wraps instead
            (#102): with its scrollbar hidden, Admin's 21 modules ran off
            the right edge at desktop width, where a mouse can't swipe. */}
        <nav
          aria-label={`${dept.label} modules`}
          className="flex flex-1 items-stretch gap-x-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible"
        >
          {head.map(item)}
          {tail.length > 0 && <div className="flex items-stretch gap-x-5 md:ml-auto">{tail.map(item)}</div>}
        </nav>
      </div>
    </div>
  );
}

/**
 * The one module the current page belongs to: the live module whose href
 * is the longest segment-wise prefix of the path.
 *
 * A plain `pathname.startsWith(href)` lit up two chips at once — the
 * Academy's "Course Library" is /academy, which prefixes every academy
 * page, so on /academy/assignments both it and Assignments showed as
 * current. It would also let /fuel claim /fuel-supplier. Matching whole
 * segments and keeping the most specific match fixes both.
 */
export function activeModuleId(
  modules: readonly Pick<ModuleEntry, "id" | "href" | "status">[],
  pathname: string,
): string | null {
  const trim = (p: string) => p.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const path = trim(pathname);
  let best: { id: string; length: number } | null = null;
  for (const m of modules) {
    if (m.status !== "live" || !m.href) continue;
    const href = trim(m.href);
    const matches =
      path === href || path.startsWith(href === "/" ? "/" : `${href}/`);
    if (matches && (!best || href.length > best.length)) {
      best = { id: m.id, length: href.length };
    }
  }
  return best?.id ?? null;
}

function DepartmentNavItem({
  module,
  isActive,
}: {
  module: ModuleEntry;
  isActive: boolean;
}) {
  const isLive = module.status === "live";
  const isPurple = module.accent === "purple";

  // Muted by default; the active module takes the brand, as every other
  // "you are here" in the app does. AI modules keep purple — the one
  // accent besides the brand, and it means "AI" everywhere it appears.
  // (The active background here was `bg-primary/12`, an off-scale opacity
  // that generated no CSS, so the current module had no highlight at all.)
  const baseTone = isPurple
    ? isActive
      ? "text-status-purple after:bg-status-purple"
      : "text-status-purple hover:after:bg-status-purple/40"
    : isActive
      ? "text-foreground after:bg-brand-ink"
      : "text-muted-foreground hover:text-foreground";

  const className = cn(
    "relative flex min-h-11 items-center whitespace-nowrap text-[0.8125rem] font-semibold transition-colors",
    "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5",
    baseTone,
    !isLive && "opacity-40 cursor-not-allowed",
  );

  const before = (
    <>
      {module.pushRight && <span className="flex-1" />}
      {module.dividerBefore && (
        <span className="mx-1 h-3 w-px self-center bg-border" aria-hidden />
      )}
    </>
  );

  if (!isLive || !module.href) {
    return (
      <>
        {before}
        <span
          className={className}
          title={moduleStatusHint(module.status)}
          aria-disabled="true"
          data-testid={`dept-nav-${module.id}`}
        >
          {module.label}
        </span>
      </>
    );
  }

  return (
    <>
      {before}
      <Link
        href={module.href}
        className={className}
        aria-current={isActive ? "page" : undefined}
        data-testid={`dept-nav-${module.id}`}
      >
        {module.label}
      </Link>
    </>
  );
}

/** Drawn, not from an icon set (#78): a roof and walls at 14px. */
function HomeGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M2.5 7.5 8 3l5.5 4.5M4 6.5V13h8V6.5" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="m3.5 2 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
