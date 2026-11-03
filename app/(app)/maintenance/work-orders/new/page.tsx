import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { linkCaps } from "@/components/ff/controls";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getSquawk } from "@/lib/api/maintenance";
import { listAircraft } from "@/lib/api/ops";
import type { AircraftListItem, SquawkResponse } from "@/lib/api/types";
import { localDay } from "@/lib/format/local-time";
import { WORK_ORDER_WRITERS, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { NewWorkOrderForm } from "./new-work-order-form";

/**
 * /maintenance/work-orders/new (#134). From a squawk (`?squawk=`), the
 * work order is for its aircraft, says what was found, and resolving it
 * later resolves the squawk.
 */
export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ squawk?: string; aircraft?: string }>;
}) {
  if (!hasAnyRole((await auth())?.roles ?? [], WORK_ORDER_WRITERS)) {
    redirect("/maintenance/work-orders");
  }
  const { squawk: squawkId, aircraft: aircraftId } = await searchParams;
  let aircraft: AircraftListItem[] = [];
  let squawk: SquawkResponse | null = null;
  let loadError: string | null = null;
  const [fleet, found, zones] = await Promise.allSettled([
    listAircraft(),
    squawkId ? getSquawk(squawkId) : Promise.resolve(null),
    loadZoneTable(),
  ]);
  if (fleet.status === "fulfilled") aircraft = fleet.value.items;
  else {
    const status = fleet.reason instanceof ApiError ? fleet.reason.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Couldn't load the fleet. Try refreshing in a moment.";
  }
  if (found.status === "fulfilled") squawk = found.value;
  else if (squawkId) loadError ??= "That squawk couldn't be read; open the work order without it.";
  const today = localDay(zones.status === "fulfilled" ? zones.value.fallback : "America/Anchorage");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={squawk ? "/maintenance/squawks" : "/maintenance/work-orders"}
        className={cn(linkCaps, "mb-4 text-muted-foreground hover:text-foreground")}
      >
        <span aria-hidden>‹</span> {squawk ? "Squawks" : "Work Orders"}
      </Link>
      <h1 className="page-title mb-2">New Work Order</h1>
      <p className="mb-6 border-b border-border pb-5 text-sm text-muted-foreground">
        {squawk
          ? `For the squawk on ${squawk.aircraft.tail_number}: ${squawk.title}. Completing the work order can resolve the squawk.`
          : "Open a work order for an aircraft."}
      </p>
      {loadError && (
        <div role="alert" className="mb-4 notice notice-yellow">
          {loadError}
        </div>
      )}
      <div className="rounded-lg border border-border bg-card p-4">
        <NewWorkOrderForm
          aircraft={aircraft.filter((a) => a.is_active || a.id === squawk?.aircraft.id || a.id === aircraftId)}
          squawk={squawk}
          aircraftId={squawk?.aircraft.id ?? aircraftId ?? null}
          today={today}
        />
      </div>
    </div>
  );
}
