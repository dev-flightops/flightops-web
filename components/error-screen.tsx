"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertCircle, LogIn, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
  /**
   * Which sign-in this screen belongs to. The fuel-supplier portal is a
   * separate audience on a separate credential: it authenticates with
   * its own `fuel_supplier_session` cookie, not the staff Auth.js
   * session. Calling next-auth's signOut() there would clear a session
   * the supplier does not have and send them to the staff login, so the
   * re-login path has to differ. Defaults to staff, which is every
   * in-app page.
   */
  audience?: "staff" | "fuel-supplier";
}

/**
 * Next replaces the message of any server-component throw in a
 * production build, to avoid leaking internals. What it substitutes is
 * three sentences of React internals:
 *
 *   "An error occurred in the Server Components render. The specific
 *    message is omitted in production builds to avoid leaking sensitive
 *    details. A digest property is included on this error instance
 *    which may provide additional details about the nature of the
 *    error."
 *
 * Rendering `error.message` straight through puts that paragraph in
 * front of a dispatcher, talking about digest properties on error
 * instances. It never appears in `next dev`, which is why it survived:
 * in development the real message is passed through and reads fine.
 *
 * There is nothing to show a user here, so we show our own sentence and
 * let the Error ID below carry the diagnostic weight — which is exactly
 * what Next's own text is trying to say, at length.
 *
 * Matched on substrings rather than the whole string: Next has more than
 * one variant ("...but no message was provided") and has reworded them
 * across releases. These two fragments are what has stayed put.
 */
function isRedactedByNext(message: string): boolean {
  return (
    message.includes("omitted in production builds") ||
    message.includes("no message was provided")
  );
}

/**
 * Shared error UI for Next.js error boundaries. Distinguishes session
 * expiry (offers re-login) from generic errors (offers retry).
 */
export function ErrorScreen({
  error,
  reset,
  audience = "staff",
}: ErrorScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Class identity is lost across the server→client boundary, but the
  // `name` property survives. apiFetch sets it to "SessionExpiredError".
  const isSessionExpired = error.name === "SessionExpiredError";
  const GENERIC =
    "An unexpected error occurred while loading this page. Retrying often clears it; quote the Error ID below if it does not.";
  // Empty, whitespace-only and redacted messages all fall back.
  const detail =
    error.message && error.message.trim() && !isRedactedByNext(error.message)
      ? error.message
      : GENERIC;

  const loginPath =
    audience === "fuel-supplier" ? "/fuel-supplier/login" : "/login";

  const handleReLogin = () => {
    startTransition(async () => {
      // Staff only. The Auth.js cookie is signed with AUTH_SECRET and
      // stays "valid" independently of the FlightOps JWT, so leaving it
      // in place means proxy.ts sees a logged-in user and bounces
      // straight back into the failing page. A supplier has no such
      // cookie — clearing it would sign out an unrelated staff session
      // sharing the browser.
      if (audience === "staff") {
        await signOut({ redirect: false });
      }
      router.push(loginPath);
      router.refresh();
    });
  };

  return (
    <main className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-12 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h1 className="text-2xl font-semibold tracking-tight">
        {isSessionExpired ? "Session expired" : "Something went wrong"}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {isSessionExpired
          ? "Your sign-in has expired. Sign in again to continue."
          : detail}
      </p>

      <div className="mt-2 flex gap-2">
        {isSessionExpired ? (
          <Button onClick={handleReLogin} disabled={isPending}>
            <LogIn className="h-4 w-4" />
            {isPending ? "Signing in…" : "Sign in again"}
          </Button>
        ) : (
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
      </div>

      {error.digest && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
    </main>
  );
}
