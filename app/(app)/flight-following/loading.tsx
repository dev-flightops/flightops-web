import { LoadingPanel } from "@/components/ui/spinner";

/**
 * Next.js App Router automatic Suspense boundary for /flight-following.
 *
 * Shown while the page server component re-renders — most importantly
 * during tab navigation (Today→Tomorrow), display switches
 * (List→Map), and full page reloads where the positions feed is being
 * fetched. Without this file the user sees the stale page until the
 * new one streams in; with it they see a spinner immediately.
 *
 * We render the page chrome's container shape so the spinner box
 * lands where the real board will, avoiding layout shift when the
 * real content streams in.
 */
export default function FlightFollowingLoading() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-7xl flex-col px-4 py-6 sm:px-6">
      <LoadingPanel
        label="Loading flight board…"
        className="min-h-[400px]"
      />
    </div>
  );
}
