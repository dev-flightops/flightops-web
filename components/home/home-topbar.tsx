import Link from "next/link";
import { type ReactNode } from "react";

/** Top bar for the /home pitch landing.
 *
 *  Structure:
 *    - Solid red primary chip on the far left ("Book"-style placement)
 *    - Brand wordmark next to the chip
 *    - Optional phone number center-right
 *    - Right-side actions cluster passed via `actionsSlot` — we render
 *      the app's DEFAULT HeaderActions here so nothing is swapped or
 *      invented; only the container's background + spacing changes.
 *
 *  The app-shell hides its own header on /home (see AppShellHeader) so
 *  this is the sole top chrome on the pitch landing.
 */
export function HomeTopBar({
  brand,
  phone,
  actionsSlot,
  showOpsChip = true,
}: {
  brand: string;
  /** Display phone number (e.g. "1 (555) 000-0000"). Hidden below lg. */
  phone?: string;
  /** Right-side actions cluster — pass the default HeaderActions here. */
  actionsSlot?: ReactNode;
  /** When false the red "Ops" chip is hidden. It deep-links into
   *  Reservations, which most roles do not have (client request 8/25) —
   *  offering it to a pilot sends them straight into the one module we
   *  just took off their home grid. */
  showOpsChip?: boolean;
}) {
  return (
    <div className="bg-[#0a0a0a] text-white">
      <div className="mx-auto flex h-[52px] max-w-[100rem] items-stretch">
        {/* Primary red chip — "Book"-style placement. Clicks into
         *  Reservations, so it only renders for roles that have it. */}
        {showOpsChip && (
          <Link
            href="/reservations/"
            className="flex items-center gap-2 bg-[#AB2429] px-4 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#8f1e22] sm:px-6"
          >
            <SearchIcon />
            <span>Ops</span>
          </Link>
        )}

        {/* Brand text — links back to /home, matches the app-shell's usual
         *  brand affordance so the click target stays consistent. */}
        <Link
          href="/home/"
          className="flex items-center border-l border-white/[0.08] px-4 text-[0.8rem] font-semibold tracking-tight text-white transition-colors hover:text-white/85 sm:px-5"
        >
          <span className="truncate">{brand}</span>
        </Link>

        {/* Spacer + optional phone. Phone sits center-right in the pitch layout. */}
        <div className="flex flex-1 items-stretch justify-end">
          {phone ? (
            <a
              href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
              className="hidden items-center gap-1.5 border-l border-white/[0.08] px-4 text-[0.78rem] font-medium text-white/80 transition-colors hover:text-white lg:flex"
            >
              <PhoneIcon />
              <span>{phone}</span>
            </a>
          ) : null}
        </div>

        {/* Default actions cluster — same items as everywhere else. Colors
         *  are re-tinted via the scoped .home-actions style block so the
         *  cluster reads correctly on the black bar. */}
        {actionsSlot ? (
          <div className="home-actions flex items-center border-l border-white/[0.08] pl-2 pr-3 sm:pl-3 sm:pr-4">
            {actionsSlot}
          </div>
        ) : null}
      </div>

      {/* Scoped restyle for the default HeaderActions cluster so it fits the
       *  dark pitch bar. Only descendants of .home-actions are affected. */}
      <style>{`
        .home-actions button:not(:disabled),
        .home-actions a {
          color: rgba(255, 255, 255, 0.85);
        }
        .home-actions button:not(:disabled):hover,
        .home-actions a:hover {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.08);
        }
        .home-actions button:disabled {
          color: rgba(255, 255, 255, 0.35);
        }
        .home-actions [class*="border-"] {
          border-color: rgba(255, 255, 255, 0.10);
        }
        /* Spotlight search trigger — chip on dark bar */
        .home-actions button[title*="Search"] {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
        }
        .home-actions button[title*="Search"] kbd {
          background: rgba(255, 255, 255, 0.10) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        /* Settings gold accent stays — but a touch warmer on black */
        .home-actions a[href="/settings"] {
          color: #fbbf24 !important;
        }
        .home-actions a[href="/settings"]:hover {
          color: #fcd34d !important;
        }
        /* User identity strip — avatar circle keeps its own bg, name goes white */
        .home-actions [title][aria-hidden] {
          background: linear-gradient(135deg, #AB2429 0%, #7a1c20 100%) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          color: #ffffff !important;
        }
        /* Clock In pill — keep the tinted look but on dark it needs a bump */
        .home-actions button[title*="Time Clock"] {
          background: rgba(171, 36, 41, 0.15) !important;
          border-color: rgba(171, 36, 41, 0.4) !important;
          color: #ff6b6f !important;
        }
      `}</style>
    </div>
  );
}

// ---------- Inline SVG icons ----

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
