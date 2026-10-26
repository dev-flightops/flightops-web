import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { buttonOutline } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { loadZoneTable } from "@/lib/api/auth";
import { getCheckIn, type CheckInView } from "@/lib/api/check-in";
import { ApiError } from "@/lib/api/client";
import { listFlightCrew } from "@/lib/api/crew-assignments";
import { localDateTime, zoneFor } from "@/lib/format/local-time";
import { CHECKIN_ROLES, hasAnyRole } from "@/lib/roles";

import { CheckInBoard } from "./check-in-board";

export const dynamic = "force-dynamic";

/**
 * /check-in/[flightId] — gate check-in for one flight (#103).
 *
 * Legacy `templates/checkin/dashboard.html`: the flight, the boarding
 * controls, counts, planned against actual weight, and every passenger
 * with what can be done to them. Ours lists the manifest's passengers,
 * since our bookings carry a count rather than names; crew are not
 * checked in. Anyone on staff can see it; the check-in roles act, and the
 * flight's own crew, at a village without an agent (#119).
 */
export default async function CheckInPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await params;
  let view: CheckInView;
  try {
    view = await getCheckIn(flightId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [session, zones, crew] = await Promise.all([
    auth(),
    loadZoneTable(),
    listFlightCrew(flightId).catch(() => null),
  ]);
  const me = session?.user?.id;
  const crewing = Boolean(me && crew?.items.some((c) => c.user.id === me));
  const canAct = hasAnyRole(session?.roles ?? [], CHECKIN_ROLES) || crewing;
  const departs = localDateTime(view.scheduled_departure_at, zoneFor(zones, view.origin));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/manifest", label: "Flight Schedule" }}
        eyebrow="Gate Check-in"
        title={view.flight_number}
        description={`${view.origin} → ${view.destination} · ${view.tail_number ?? "No aircraft"} · Departs ${departs}`}
        actions={
          <>
            <Link href={`/manifest/${view.flight_id}`} className={buttonOutline}>
              Manifest
            </Link>
            <Link href={`/dispatch?flight=${view.flight_id}`} className={buttonOutline}>
              Dispatch Packet
            </Link>
          </>
        }
      />
      <CheckInBoard initial={view} canAct={canAct} />
    </div>
  );
}
