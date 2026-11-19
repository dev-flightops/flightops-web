"use client";

import { useTransition } from "react";

import { SignOutGlyph } from "@/components/ff/glyphs";
import { fullPageLoad } from "@/lib/navigation/full-load";

/**
 * Sign out (#201): the server action ends the session and marks when, then
 * a full page load to the sign-in. The action's own redirect was a soft
 * navigation, and the page's requests still in flight (link prefetches, the
 * bell) came back with the session: pressed half a second after a page
 * loaded, Sign out did not hold 1 time in 3. The load drops them, and the
 * mark refuses any that land first.
 */
export function SignOutButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      try {
        await action();
      } catch {
        // Still leave: the sign-in page loads if the session ended, and
        // Home again if it didn't, so where things stand is plain.
      }
      fullPageLoad("/login");
    });
  // The form posts the action itself where the page's script never ran;
  // with it, the click takes the path above instead.
  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(event) => {
          event.preventDefault();
          signOut();
        }}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md p-2 text-xs font-medium text-muted-foreground hover:bg-foreground/8 hover:text-foreground disabled:opacity-60"
        aria-label="Sign out"
      >
        <span className="hidden sm:inline">{pending ? "Signing out…" : "Sign out"}</span>
        <SignOutGlyph className="h-3 w-3 sm:hidden" aria-hidden />
      </button>
    </form>
  );
}
