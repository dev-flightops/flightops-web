import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  getHousingUnit,
  listHousingBookings,
  ROOM_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  type HousingBooking,
  type HousingRoom,
  type HousingUnit,
  type RoomStatus,
} from "@/lib/api/housing";

import { AddRoomDrawer } from "./add-room-form";

/**
 * /housing/[unitId] — Housing unit detail.
 *
 * Shows the unit header, per-room list (with occupied badge from
 * today's active bookings), and the raw bookings list for the unit
 * (active first, then cancelled). "+ Add Room" drawer creates a new
 * room via server action; the parent /housing page revalidates on
 * success so counts stay honest.
 */
export const dynamic = "force-dynamic";

export default async function HousingUnitDetailPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;

  let unit: HousingUnit;
  let rooms: HousingRoom[] = [];
  try {
    const detail = await getHousingUnit(unitId);
    unit = detail.unit;
    rooms = detail.rooms;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Bookings — pull today+ so we can flag occupied rooms and show a
  // small activity list. Soft-fails: empty rooms + no bookings is a
  // valid state.
  let bookings: HousingBooking[] = [];
  try {
    const resp = await listHousingBookings({
      from: isoDateToday(),
    });
    bookings = resp.items.filter((b) => b.unit_id === unitId);
  } catch {
    bookings = [];
  }

  const today = isoDateToday();
  const occupiedRoomIds = new Set(
    bookings
      .filter(
        (b) =>
          !b.is_cancelled &&
          b.check_in <= today &&
          (b.check_out === null || b.check_out >= today),
      )
      .map((b) => b.room_id),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
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
        <Link
          href="/housing"
          className="text-muted-foreground hover:text-foreground"
        >
          Housing
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="font-semibold text-status-blue">{unit.name}</span>
      </nav>

      <header className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            Housing Unit
          </div>
          <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">{unit.name}</h1>
          <div className="mt-1 flex flex-wrap items-baseline gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{unit.station}</span>
            {unit.address && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{unit.address}</span>
              </>
            )}
            {!unit.is_active && (
              <span className="rounded border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-status-yellow">
                Inactive
              </span>
            )}
          </div>
          {(unit.contact_person || unit.contact_phone) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {unit.contact_person}
              {unit.contact_person && unit.contact_phone ? " · " : ""}
              {unit.contact_phone}
            </p>
          )}
        </div>
        <AddRoomDrawer unitId={unit.id} />
      </header>

      <RoomsCard rooms={rooms} occupiedRoomIds={occupiedRoomIds} />

      <BookingsCard bookings={bookings} rooms={rooms} />

      {unit.notes && (
        <div className="mt-6 rounded-md border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em]">
            Notes
          </p>
          <p className="whitespace-pre-wrap text-foreground/80">{unit.notes}</p>
        </div>
      )}
    </div>
  );
}

function RoomsCard({
  rooms,
  occupiedRoomIds,
}: {
  rooms: HousingRoom[];
  occupiedRoomIds: Set<string>;
}) {
  const sorted = [...rooms].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, {
      numeric: true,
    }),
  );
  const totalCapacity = sorted.reduce((sum, r) => sum + r.capacity, 0);

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rooms
        </h2>
        <span className="text-xs text-muted-foreground/60">
          {sorted.length} room{sorted.length === 1 ? "" : "s"} · {totalCapacity}{" "}
          beds
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {sorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No rooms added yet. Use{" "}
            <span className="font-semibold">+ Add Room</span> above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Room</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Capacity
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Amenities</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Cost / night
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold">
                      {r.room_number}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {ROOM_TYPE_LABELS[
                        r.room_type as keyof typeof ROOM_TYPE_LABELS
                      ] ?? r.room_type}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">
                      {r.capacity}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <RoomStatusBadge
                        status={r.status as RoomStatus}
                        occupied={occupiedRoomIds.has(r.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      <AmenityChips room={r} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                      {fmtCost(r.cost_per_night)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function BookingsCard({
  bookings,
  rooms,
}: {
  bookings: HousingBooking[];
  rooms: HousingRoom[];
}) {
  if (bookings.length === 0) return null;
  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const sorted = [...bookings].sort((a, b) =>
    (a.check_in ?? "").localeCompare(b.check_in ?? ""),
  );
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bookings
        </h2>
        <span className="text-xs text-muted-foreground/60">
          {sorted.length} upcoming / active
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Room</th>
                <th className="px-3 py-2.5 font-semibold">Employee</th>
                <th className="px-3 py-2.5 font-semibold">Check in</th>
                <th className="px-3 py-2.5 font-semibold">Check out</th>
                <th className="px-3 py-2.5 font-semibold">Purpose</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((b) => {
                const room = roomsById.get(b.room_id);
                return (
                  <tr
                    key={b.id}
                    className={
                      "hover:bg-muted/5 " +
                      (b.is_cancelled ? "opacity-50" : "")
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                      {room?.room_number ?? b.room_number ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {b.employee_name ?? b.employee_user_id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                      {b.check_in}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {b.check_out ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {b.purpose ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {b.is_cancelled ? (
                        <span className="rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          Cancelled
                        </span>
                      ) : (
                        <span className="rounded border border-status-green/40 bg-status-green/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-green">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AmenityChips({ room }: { room: HousingRoom }) {
  const flags: string[] = [];
  if (room.has_wifi) flags.push("Wi-Fi");
  if (room.has_kitchen) flags.push("Kitchen");
  if (room.has_private_bath) flags.push("Priv. bath");
  if (room.has_laundry) flags.push("Laundry");
  if (flags.length === 0 && !room.amenities) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className="rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
        >
          {f}
        </span>
      ))}
      {room.amenities && (
        <span className="text-[0.7rem] text-muted-foreground">
          · {room.amenities}
        </span>
      )}
    </div>
  );
}

function RoomStatusBadge({
  status,
  occupied,
}: {
  status: RoomStatus;
  occupied: boolean;
}) {
  const map: Record<RoomStatus, string> = {
    available: occupied
      ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
      : "border-status-green/40 bg-status-green/10 text-status-green",
    occupied: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    maintenance:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    offline: "border-border bg-muted/20 text-muted-foreground",
  };
  const label =
    status === "available" && occupied
      ? "In use"
      : (ROOM_STATUS_LABELS[status] ?? status);
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        (map[status] ?? "border-border bg-muted/20 text-muted-foreground")
      }
    >
      {label}
    </span>
  );
}

function fmtCost(v: string | number | null): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "—";
  return `$${n.toFixed(2)}`;
}

function isoDateToday(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
