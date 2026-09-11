"use client";

import { ErrorScreen } from "@/components/error-screen";

/**
 * Error boundary for the whole (app) route group — every authenticated
 * page. Previously only /dashboards and /dispatch had one, so a throw
 * in any of the other ~140 pages fell through to Next's default screen
 * with no retry, no sign-in route out of an expired session, and none
 * of the app chrome.
 *
 * Sits above the segment-level boundaries, which still win where they
 * exist (Next uses the nearest). A throw in this group's *layout* is
 * not caught here — see app/global-error.tsx.
 */
export default function AppError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen {...props} />;
}
