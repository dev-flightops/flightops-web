import Link from "next/link";

import { getFlightTrackingConfig } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

import { TrackingForm } from "./tracking-form";

/**
 * /settings/flight-tracking — Flight tracking config (M2-G-53).
 *
 * Single-form page bound to the get-or-create FlightTrackingConfig row.
 * Drives overdue alerts, position-polling cadence, and the
 * SIMULATION-MODE banner on the fleet map.
 */
export default async function SettingsFlightTrackingPage() {
  try {
    const config = await getFlightTrackingConfig();
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Breadcrumb />
        <header className="mb-6 border-b border-border pb-5">
          <h1 className="page-title">
            Flight Tracking
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Overdue thresholds, polling cadence, simulation mode, and Spider
            Tracks AFF
          </p>
        </header>
        <TrackingForm config={config} />
      </div>
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    const message =
      status === 401
        ? "Your session expired — please sign in again."
        : "Tracking config unavailable. Try refreshing in a moment.";
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Breadcrumb />
        <div
          role="alert"
          className="notice notice-yellow"
        >
          {message}
        </div>
      </div>
    );
  }
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
      <Link href="/settings" className="hover:text-foreground">
        Settings
      </Link>
      <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
      <span className="text-foreground">Flight Tracking</span>
    </nav>
  );
}
