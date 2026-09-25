"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

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
 * instead), the light module strip.
 */
export function AppShellHeader({
  brand,
  actionsSlot,
  roles = [],
  showOpsChip = false,
  opsPhone = null,
}: {
  brand: string;
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
}) {
  const pathname = usePathname();
  const isHome = pathname === "/home" || pathname === "/home/";

  return (
    <header className="sticky top-0 z-40">
      <div className="dark bg-background text-foreground">
        <div className="mx-auto flex h-[52px] max-w-[100rem] items-stretch">
          {showOpsChip && (
            <Link
              href="/reservations/"
              className="flex items-center gap-2 bg-primary px-4 text-[0.8rem] font-semibold text-primary-foreground transition-colors hover:bg-brand-dark sm:px-6"
            >
              <SearchIcon />
              <span>Ops</span>
            </Link>
          )}

          <Link
            href="/home/"
            className="flex min-w-0 items-center border-l border-border px-4 text-[0.8rem] font-semibold tracking-tight text-foreground transition-colors hover:text-foreground/80 sm:px-5"
          >
            <span className="truncate">{brand}</span>
          </Link>

          <div className="flex flex-1 items-stretch justify-end">
            {opsPhone ? (
              <a
                href={`tel:${opsPhone.replace(/[^0-9+]/g, "")}`}
                className="hidden items-center gap-1.5 border-l border-border px-4 text-[0.78rem] font-medium text-muted-foreground transition-colors hover:text-foreground lg:flex"
              >
                <PhoneIcon />
                <span>{opsPhone}</span>
              </a>
            ) : null}
          </div>

          {actionsSlot ? (
            <div className="flex items-center border-l border-border pl-2 pr-3 sm:pl-3 sm:pr-4">
              {actionsSlot}
            </div>
          ) : null}
        </div>
      </div>

      {!isHome && <DepartmentNav roles={roles} />}
    </header>
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
