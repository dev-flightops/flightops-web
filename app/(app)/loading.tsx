import { LoadingPanel } from "@/components/ui/spinner";

/**
 * Every in-app page's loading state (#142), the Next.js Suspense boundary
 * for the (app) group.
 *
 * Greg, 29 Oct: "some pages takes some for loading, in that case show
 * loading animation". Without it the old page stayed on screen until the
 * new one had loaded, with no sign that anything was happening; on the
 * demo's tunnel that can be several seconds. The header and the
 * department menu stay in place: this fills the content area, in the
 * page container's shape. Flight Following has its own.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-7xl flex-col px-4 py-6 sm:px-6">
      <LoadingPanel label="Loading…" className="min-h-[400px]" />
    </div>
  );
}
