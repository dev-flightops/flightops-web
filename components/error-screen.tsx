"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertCircle, LogIn, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Shared error UI for Next.js error boundaries. Distinguishes session
 * expiry (offers re-login) from generic errors (offers retry).
 */
export function ErrorScreen({ error, reset }: ErrorScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Class identity is lost across the server→client boundary, but the
  // `name` property survives. apiFetch sets it to "SessionExpiredError".
  const isSessionExpired = error.name === "SessionExpiredError";

  const handleReLogin = () => {
    startTransition(async () => {
      await signOut({ redirect: false });
      router.push("/login");
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
          : error.message || "An unexpected error occurred while loading this page."}
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
