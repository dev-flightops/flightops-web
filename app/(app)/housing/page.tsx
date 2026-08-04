import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  listHousingBookings,
  listHousingUnits,
  type HousingBooking,
  type HousingUnit,
} from "@/lib/api/housing";

import { NewUnitDrawer } from "./new-unit-form";

/**
 * /housing — Housing Management.
 *
 * Mirrors the legacy peregrineflight.com/housing/ shell, now backed by
 * the shipped housing-service. Renders:
 *
 *   Header: "Housing Management" + rollup counts (houses / rooms /
 *   available / occupied) · [+ New House]
 *   Units grid — one card per building/dorm with station badge,
 *   contact person, and a "N rooms" hint plus "Open →" link
 *   Empty state when the tenant has no units yet.
 *
 * "Assignments" (the calendar grid Marc's housing-service will expand
 * to feed) is deferred to a follow-up story; today the unit detail
 * page (/housing/[unitId]) handles per-room bookings.
 */
export const dynamic = "force-dynamic";

export default async function HousingPage() {
  let units: HousingUnit[] = [];
  let bookings: HousingBooking[] = [];
  let loadError: string | null = null;

  try {
    const [unitsResp, bookingsResp] = await Promise.all([
      listHousingUnits(),
      // Today's bookings — used to compute the "occupied" rollup.
      listHousingBookings({ from: isoDateToday() }),
    ]);
    units = unitsResp.items;
    bookings = bookingsResp.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Housing unavailable. Try refreshing in a moment.";
  }

  const today = isoDateToday();
  const activeBookings = bookings.filter(
    (b) =>
      !b.is_cancelled &&
      b.check_in <= today &&
      (b.check_out === null || b.check_out >= today),
  );

  const stats = {
    houses: units.filter((u) => u.is_active).length,
    inactive: units.filter((u) => !u.is_active).length,
    occupied: activeBookings.length,
  };

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-xs">
        <Link
          href="/home"
          aria-label="Home"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="font-semibold text-status-blue">Housing</span>
      </nav>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Housing Management
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.houses} active house{stats.houses === 1 ? "" : "s"}
            {stats.inactive > 0 && (
              <span className="text-muted-foreground/70">
                {" "}
                · {stats.inactive} inactive
              </span>
            )}
            {" · "}
            <span
              className={
                stats.occupied > 0
                  ? "text-status-yellow"
                  : "text-status-green"
              }
            >
              {stats.occupied} occupied today
            </span>
          </p>
        </div>
        <NewUnitDrawer />
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : units.length === 0 ? (
        <EmptyState />
      ) : (
        <UnitsGrid units={units} bookings={activeBookings} />
      )}
    </div>
  );
}

function UnitsGrid({
  units,
  bookings,
}: {
  units: HousingUnit[];
  bookings: HousingBooking[];
}) {
  const bookingsByUnit = new Map<string, number>();
  for (const b of bookings) {
    if (!b.unit_id) continue;
    bookingsByUnit.set(b.unit_id, (bookingsByUnit.get(b.unit_id) ?? 0) + 1);
  }

  const active = units.filter((u) => u.is_active);
  const inactive = units.filter((u) => !u.is_active);

  return (
    <div className="space-y-6">
      <UnitsSection
        title="Active"
        units={active}
        bookingsByUnit={bookingsByUnit}
      />
      {inactive.length > 0 && (
        <UnitsSection
          title="Inactive"
          units={inactive}
          bookingsByUnit={bookingsByUnit}
          muted
        />
      )}
    </div>
  );
}

function UnitsSection({
  title,
  units,
  bookingsByUnit,
  muted = false,
}: {
  title: string;
  units: HousingUnit[];
  bookingsByUnit: Map<string, number>;
  muted?: boolean;
}) {
  if (units.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title} · {units.length}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((u) => (
          <UnitCard
            key={u.id}
            unit={u}
            occupiedToday={bookingsByUnit.get(u.id) ?? 0}
            muted={muted}
          />
        ))}
      </ul>
    </section>
  );
}

function UnitCard({
  unit,
  occupiedToday,
  muted,
}: {
  unit: HousingUnit;
  occupiedToday: number;
  muted?: boolean;
}) {
  return (
    <li
      className={
        "flex flex-col justify-between rounded-lg border border-border bg-card p-4 " +
        (muted ? "opacity-70" : "")
      }
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{unit.name}</h3>
            <p className="mt-0.5 font-mono text-[0.7rem] text-muted-foreground">
              {unit.station}
            </p>
          </div>
          {unit.color_accent && (
            <span
              aria-hidden
              className="mt-1 inline-block h-4 w-4 rounded-full border border-border"
              style={{ backgroundColor: unit.color_accent }}
              title={unit.color_accent}
            />
          )}
        </div>
        {unit.contact_person && (
          <p className="text-[0.7rem] text-muted-foreground">
            <span className="text-muted-foreground/70">Contact: </span>
            {unit.contact_person}
            {unit.contact_phone && (
              <span className="ml-1 text-muted-foreground/70">
                · {unit.contact_phone}
              </span>
            )}
          </p>
        )}
        {unit.address && (
          <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">
            {unit.address}
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
        <span
          className={
            occupiedToday > 0
              ? "font-medium text-status-yellow"
              : "text-muted-foreground"
          }
        >
          {occupiedToday} occupied today
        </span>
        <Link
          href={`/housing/${unit.id}`}
          className="font-semibold text-status-blue hover:underline"
        >
          Open →
        </Link>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
      <p className="mb-2 text-sm text-foreground">
        No housing units yet.
      </p>
      <p className="mx-auto max-w-md text-xs text-muted-foreground">
        Create your first house or dorm to start tracking rooms and crew
        assignments. Use the <span className="font-semibold">+ New House</span>{" "}
        button above.
      </p>
    </div>
  );
}

function isoDateToday(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
