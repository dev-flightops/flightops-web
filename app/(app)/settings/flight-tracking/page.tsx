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
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Breadcrumb />
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Flight Tracking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Breadcrumb />
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {message}
        </div>
      </div>
    );
  }
}

function Breadcrumb() {
  return (
    <nav className="mb-4 text-xs text-muted-foreground">
      <Link href="/settings" className="hover:text-foreground">
        Settings
      </Link>
      <span className="px-1.5">/</span>
      <span className="text-foreground">Flight Tracking</span>
    </nav>
  );
}
