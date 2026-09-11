"use client";

import { ErrorScreen } from "@/components/error-screen";

/**
 * Error boundary for the (auth) group — the staff login page. Without
 * one, a throw here fell all the way to global-error, which says "the
 * app could not start"; that is the wrong story for a login form that
 * failed to render, and it drops the user further from where they were
 * trying to get.
 */
export default function AuthError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen {...props} />;
}
