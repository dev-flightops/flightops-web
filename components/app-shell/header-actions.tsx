import Link from "next/link";

import { LogOut, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The right-side cluster of the top nav. Pixel-match for the legacy
 * `dispatch-platform-main/templates/base.html` header (lines 273-380):
 *
 *   🔔 Notifications | ✨ AI | 🕒 Clock In | 👥 Users | ⭐ Owner | ❔ Help | 👤 Name | ⚙ Settings | Sign out
 *
 * Sizing matches the legacy exactly:
 *   - icon-only buttons use `p-2` (8px all sides) so each button's width
 *     follows the icon's natural size (bell 16px → 32px box, users 12px →
 *     28px box). Mirrors legacy `nav-link p-2`.
 *   - Clock button uses `p-1.5` and explicit border + tinted bg — same
 *     rule the legacy applies for the only non-icon-only chip.
 *   - Avatar circle is 24×24 with a left-border identity cluster.
 *
 * Per project policy, every entry is rendered but only those backed by a
 * shipped service are interactive. Today only the user avatar + Sign out
 * work; everything else is `<button disabled>` with a "Coming in Mx" tooltip.
 */

export interface HeaderActionsProps {
  email: string;
  fullName?: string | null;
  signOutAction: () => Promise<void>;
}

export function HeaderActions({
  email,
  fullName,
  signOutAction,
}: HeaderActionsProps) {
  const displayName = fullName?.trim() || email;
  const initial = (displayName[0] ?? "U").toUpperCase();

  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <IconButton
        title="Notifications · Coming in M3"
        disabled
        srLabel="Notifications"
        className="hidden sm:inline-flex"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
      </IconButton>

      <IconButton
        title="AI Assistant · Coming in M4"
        disabled
        srLabel="AI Assistant"
        className="hidden text-status-purple sm:inline-flex"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
      </IconButton>

      {/* Clock button — its own pill, not an IconButton. Default (clocked-out)
          state shows iOS-blue text on a faint blue tint with a bordered chip;
          when crew-service ships in M3 the active state will turn green.
          Hidden below sm because clock-in is a desktop/tablet workflow. */}
      <button
        type="button"
        disabled
        title="Time Clock · Coming in M3"
        aria-label="Time Clock"
        className="hidden cursor-not-allowed items-center gap-1 rounded-md border border-border bg-primary/8 p-1.5 text-xs font-semibold text-primary opacity-50 sm:inline-flex"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
        </svg>
        <span>Clock In</span>
      </button>

      <IconButton
        title="User Management · Coming in M4"
        disabled
        srLabel="Users"
        className="hidden text-xs sm:inline-flex"
        inlineText
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
        <span className="hidden lg:inline">Users</span>
      </IconButton>

      <IconButton
        title="Owner Admin · Coming in M4"
        disabled
        srLabel="Owner Admin"
        className="hidden text-status-yellow sm:inline-flex"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L9.2 8H2l6 4.4-2.3 7.1L12 15l6.3 4.5L16 12.4 22 8h-7.2L12 1z" />
        </svg>
      </IconButton>

      <IconButton
        title="Help · Coming in M4"
        disabled
        srLabel="Help"
        className="hidden sm:inline-flex"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
        </svg>
      </IconButton>

      {/* User identity cluster — 24×24 avatar + name, left-bordered like legacy. */}
      <div className="hidden items-center gap-2 border-l border-border pl-2 sm:flex">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-gradient-to-br from-[#1a2a3e] to-[#0a1f3d] text-[0.65rem] font-bold text-muted-foreground"
          title={displayName}
          aria-hidden
        >
          {initial}
        </div>
        <span className="hidden text-xs font-medium text-muted-foreground lg:inline">
          {displayName}
        </span>
      </div>

      {/* Settings shipped across M2 (M2-G-46/47/48/53 + SSO admin) — the
          old disabled placeholder is now a real link to the /settings
          landing. Matches legacy where the gear is the always-visible
          way back to tenant config from anywhere in the app. */}
      <Link
        href="/settings"
        title="Settings"
        aria-label="Settings"
        className="inline-flex items-center gap-1 rounded-md p-2 text-xs font-medium text-status-yellow hover:bg-primary/8"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.61 3.61 0 0112 15.6z" />
        </svg>
        <span className="hidden sm:inline">Settings</span>
      </Link>

      {/* Sign out — the only fully wired action in the cluster today. */}
      <form action={signOutAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md p-2 text-xs font-medium text-muted-foreground hover:bg-primary/8 hover:text-status-blue"
          aria-label="Sign out"
        >
          <span className="hidden sm:inline">Sign out</span>
          <LogOut className="h-3 w-3 sm:hidden" aria-hidden />
        </button>
      </form>
    </div>
  );
}

/**
 * Small button used throughout the cluster — sized by content (`p-2`) so
 * each button's width follows the icon's natural pixel size, exactly like
 * legacy `nav-link p-2`. `inlineText` adds a small gap when the icon is
 * followed by a text span.
 */
function IconButton({
  title,
  disabled,
  srLabel,
  className,
  inlineText,
  children,
}: {
  title: string;
  disabled?: boolean;
  srLabel: string;
  className?: string;
  inlineText?: boolean;
  children: React.ReactNode;
}) {
  const base = cn(
    "inline-flex items-center justify-center rounded-md bg-transparent p-2 text-muted-foreground",
    inlineText && "gap-1",
    disabled
      ? "cursor-not-allowed opacity-50"
      : "cursor-pointer hover:bg-primary/8 hover:text-status-blue",
    className,
  );
  return (
    <button
      type="button"
      className={base}
      title={title}
      disabled={disabled}
      aria-label={srLabel}
    >
      {children}
    </button>
  );
}
