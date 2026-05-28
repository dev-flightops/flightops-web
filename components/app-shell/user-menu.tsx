import { LogOut } from "lucide-react";

/**
 * Compact user identity + sign-out, designed to slot into the right end of
 * the primary nav. Mirrors the legacy's top-right avatar + sign-out cluster.
 *
 * Pure presentational: the parent layout fetches the session and supplies
 * `email` + a `signOutAction` server action. That keeps AppShell free of
 * async data dependencies so it stays straightforward to test.
 */
export interface UserMenuProps {
  email: string;
  signOutAction: () => Promise<void>;
}

export function UserMenu({ email, signOutAction }: UserMenuProps) {
  const initial = (email[0] ?? "U").toUpperCase();

  return (
    <div className="flex items-center gap-3 border-l border-border pl-3">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-gradient-to-br from-[#1a2a3e] to-[#0a1f3d] text-[0.65rem] font-bold text-muted-foreground"
        title={email}
        aria-hidden
      >
        {initial}
      </div>
      <span className="hidden text-[0.7rem] font-medium text-muted-foreground lg:inline">
        {email}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md p-1.5 text-[0.7rem] font-medium text-muted-foreground hover:bg-primary/8 hover:text-status-blue"
          aria-label="Sign out"
        >
          <LogOut className="h-3 w-3" aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </form>
    </div>
  );
}
