"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";

import { ThemeSwitch } from "@/components/theme/theme-switch";
import { cn } from "@/lib/utils";

import { DepartmentNav } from "./department-nav";

/**
 * The top bar — one for every page.
 *
 * There used to be two. The (app) layout drew a grey bar here, and the
 * home page hid it and drew its own black one with the crimson Ops chip.
 * Keeping two in step failed three times in a row — the AI menu, the
 * duty seed and the notification bell each showed a degraded state on
 * /home alone, because every prop had to be sourced twice. The home
 * page's bar is the design, so it is now the only bar.
 *
 * The bar is an ink island (`className="dark"`): every token inside it
 * resolves to the near-black palette, so the shared header actions
 * render correctly on it with no overrides. The home page used to
 * restyle them with a scoped <style> block of `!important` attribute
 * selectors — `button[title*="Time Clock"]` among them, which had already
 * stopped matching when the clock pill's title changed.
 *
 * Below it, on every page but /home (which has its department grid
 * instead), the module strip.
 *
 * ForeFlight's chrome (#78): their app's navy bar (`bg-chrome` — the
 * site's slate in light mode), the operator's logo when one is set, the
 * name in the display face, the theme switch. The bar stays a `.dark`
 * island in both modes, as ForeFlight's nav does.
 */
export function AppShellHeader({
  brand,
  actionsSlot,
  roles = [],
  showOpsChip = false,
  opsPhone = null,
  homeHref = "/home/",
  showDepartmentNav = true,
  logoUrl = null,
}: {
  brand: string;
  /** The operator's logo (Settings → Company). Most are drawn for white
   *  paper, so it sits on a small light plate rather than on the navy. */
  logoUrl?: string | null;
  actionsSlot?: ReactNode;
  /** Session roles, threaded from the server layout. Passed as a prop
   *  rather than read here: importing next-auth into a presentational
   *  component drags next/server in and breaks the vitest run. */
  roles?: readonly string[];
  /** The crimson Ops chip deep-links into Reservations, which most roles
   *  cannot open (client request 8/25), so it only renders for those
   *  that can. */
  showOpsChip?: boolean;
  /** The tenant's ops line from their company profile. Hidden when
   *  unset rather than showing a placeholder number to a customer. */
  opsPhone?: string | null;
  /** Where the operator's name links. A customer or supplier login's
   *  home is the portal, not the staff dashboard. */
  homeHref?: string;
  /** The department strip is staff navigation; a customer or supplier
   *  login gets the bar alone. */
  showDepartmentNav?: boolean;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/home" || pathname === "/home/";
  // What the logo turned out to be, once it settles. A wordmark already
  // spells the name, so the name beside it is left to screen readers; an
  // emblem keeps it; a logo that will not load gives way to it.
  const [logo, setLogo] = useState<{ url: string; shape: LogoShape } | null>(null);
  const settleLogo = useCallback((url: string, shape: LogoShape) => {
    setLogo((prev) => (prev?.url === url && prev.shape === shape ? prev : { url, shape }));
  }, []);
  const logoShape = logo && logo.url === logoUrl ? logo.shape : null;

  return (
    <header className="sticky top-0 z-40">
      <div className="dark bg-chrome text-foreground">
        <div className="chrome-text mx-auto flex h-14 max-w-[100rem] items-stretch">
          {showOpsChip && (
            <Link
              href="/reservations/"
              className="btn-caps flex items-center gap-2 bg-primary px-4 text-primary-foreground transition-colors hover:bg-brand-dark sm:px-6"
            >
              <SearchIcon />
              <span>Ops</span>
            </Link>
          )}

          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-3 px-4 text-foreground transition-colors hover:text-white sm:px-5"
          >
            {logoUrl && logoShape !== "failed" ? (
              <OperatorLogo key={logoUrl} src={logoUrl} shown={logoShape !== null} onSettled={settleLogo} />
            ) : null}
            {/* The operator's name, and the platform's beneath it (#118):
                "[company] - Powered by Peregrine", the client asked. */}
            <span className="flex min-w-0 flex-col justify-center">
              <span
                className={cn(
                  "truncate font-display text-[0.95rem] font-extrabold uppercase leading-tight tracking-[0.08em]",
                  logoShape === "wordmark" && "sr-only",
                )}
              >
                {brand}
              </span>
              <span className="truncate text-[0.65rem] font-medium leading-tight text-muted-foreground">
                Powered by Peregrine
              </span>
            </span>
          </Link>

          <div className="flex flex-1 items-stretch justify-end">
            {opsPhone ? (
              <a
                href={`tel:${opsPhone.replace(/[^0-9+]/g, "")}`}
                className="hidden items-center gap-1.5 whitespace-nowrap px-4 text-[0.78rem] font-semibold tabular-nums text-foreground transition-colors hover:text-white lg:flex"
              >
                <PhoneIcon />
                <span>{opsPhone}</span>
              </a>
            ) : null}
          </div>

          <div className="hidden items-center px-3 md:flex">
            <ThemeSwitch />
          </div>

          {actionsSlot ? (
            <div className="flex items-center border-l border-white/10 pl-2 pr-3 sm:pl-3 sm:pr-4">
              {actionsSlot}
            </div>
          ) : null}
        </div>
      </div>

      {!isHome && showDepartmentNav && <DepartmentNav roles={roles} />}
    </header>
  );
}

type LogoShape = "wordmark" | "emblem" | "failed";

/** Wider than this, a logo is taken for a wordmark: one that spells the
 *  operator's name (a lockup of mark and name runs 3-5:1, a mark alone
 *  about 1:1). */
const WORDMARK_RATIO = 2.2;

/** The operator's logo on its plate. It reports what it turned out to be:
 *  a logo that will not load takes the plate with it, since an empty white
 *  box in the bar looks broken. The plate stays hidden until the image has
 *  loaded (it still fetches while hidden), so a slow failure never shows
 *  the box at all. */
function OperatorLogo({
  src,
  shown,
  onSettled,
}: {
  src: string;
  /** False until the image has loaded. */
  shown: boolean;
  onSettled: (url: string, shape: LogoShape) => void;
}) {
  const settle = useCallback(
    (img: HTMLImageElement) =>
      onSettled(src, img.naturalWidth / Math.max(1, img.naturalHeight) >= WORDMARK_RATIO ? "wordmark" : "emblem"),
    [src, onSettled],
  );
  // A load that ended before hydration fired its event before React was
  // listening; decode() settles for it all the same.
  const probe = useCallback(
    (img: HTMLImageElement | null) => {
      img?.decode?.()?.then(
        () => settle(img),
        () => onSettled(src, "failed"),
      );
    },
    [settle, onSettled, src],
  );
  return (
    <span className={cn("flex h-8 flex-shrink-0 items-center rounded-sm bg-white px-1.5", !shown && "hidden")}>
      {/* An operator-supplied URL on any host, so not next/image (which
          would need every host configured). */}
      <img
        ref={probe}
        src={src}
        alt=""
        onLoad={(e) => settle(e.currentTarget)}
        onError={() => onSettled(src, "failed")}
        className="h-6 w-auto max-w-[10rem] object-contain"
      />
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.58l2.2-2.21a1 1 0 0 0 .24-1.02A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
    </svg>
  );
}
