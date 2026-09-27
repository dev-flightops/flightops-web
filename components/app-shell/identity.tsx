import { LogOut } from "lucide-react";

/**
 * Who is signed in, and the way out — the end of the top bar for staff
 * and for customer or supplier logins alike. Shared so the two bars
 * cannot drift apart.
 */

/** 24×24 avatar + name, left-bordered like legacy. */
export function IdentityCluster({ displayName }: { displayName: string }) {
  const initial = (displayName[0] ?? "U").toUpperCase();
  return (
    <div className="hidden items-center gap-2 border-l border-border pl-2 sm:flex">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/15 bg-gradient-to-br from-primary to-brand-dark text-[0.65rem] font-bold text-primary-foreground"
        title={displayName}
        aria-hidden
      >
        {initial}
      </div>
      <span className="hidden text-xs font-medium text-muted-foreground lg:inline">
        {displayName}
      </span>
    </div>
  );
}

export function SignOutButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-md p-2 text-xs font-medium text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
        aria-label="Sign out"
      >
        <span className="hidden sm:inline">Sign out</span>
        <LogOut className="h-3 w-3 sm:hidden" aria-hidden />
      </button>
    </form>
  );
}

/**
 * The whole end of the bar for a customer or supplier login: no search,
 * alerts, AI, clock, users, help or settings — none of it is theirs.
 */
export function ExternalActions({
  displayName,
  signOutAction,
}: {
  displayName: string;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-1">
      <IdentityCluster displayName={displayName} />
      <SignOutButton action={signOutAction} />
    </div>
  );
}
