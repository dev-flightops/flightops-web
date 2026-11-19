import { SignOutButton } from "./sign-out-button";

export { SignOutButton };

/**
 * Who is signed in, and the way out — the end of the top bar for staff
 * and for customer or supplier logins alike. Shared so the two bars
 * cannot drift apart.
 */

/** The initial on a 24×24 square of the brand (#86: no round,
 *  gradient avatar) + name, left-bordered like legacy. */
export function IdentityCluster({ displayName }: { displayName: string }) {
  const initial = (displayName[0] ?? "U").toUpperCase();
  return (
    <div className="hidden items-center gap-2 border-l border-border pl-2 sm:flex">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-[0.65rem] font-bold text-primary-foreground"
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
