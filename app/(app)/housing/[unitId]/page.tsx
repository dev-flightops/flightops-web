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

import { BookStayDialog } from "@/components/housing/book-stay-dialog";
import { listStaff } from "@/lib/api/auth";

import { AddRoomDrawer } from "./add-room-form";
import { EditRoomDrawer } from "./edit-room-form";
import { EditUnitDrawer } from "./edit-unit-form";

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

  // Who can be booked in (#158): anyone on the staff.
  const people = await listStaff()
    .then((r) => r.items.map((p) => ({ id: p.id, name: p.full_name })))
    .catch(() => []);

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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link
          href="/home"
          className="hover:text-foreground"
        >
          Home
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <Link
          href="/housing"
          className="hover:text-foreground"
        >
          Housing
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="text-foreground">{unit.name}</span>
      </nav>

      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1">Housing Unit</p>
          <h1 className="page-title">{unit.name}</h1>
          <div className="mt-1 flex flex-wrap items-baseline gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{unit.station}</span>
            {unit.address && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>{unit.address}</span>
              </>
            )}
            {!unit.is_active && (
              <span className="status-mark text-status-yellow">
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
        <div className="flex flex-wrap items-center gap-2">
          {rooms.length > 0 ? (
            <BookStayDialog
              rooms={rooms.map((r) => ({
                id: r.id,
                label: `${r.room_number} (${ROOM_TYPE_LABELS[r.room_type as keyof typeof ROOM_TYPE_LABELS] ?? r.room_type}, holds ${r.capacity})`,
              }))}
              people={people}
            />
          ) : null}
          <EditUnitDrawer unit={unit} />
          <AddRoomDrawer unitId={unit.id} />
        </div>
      </header>

      <RoomsCard
        unitId={unit.id}
        rooms={rooms}
        occupiedRoomIds={occupiedRoomIds}
      />

      <BookingsCard bookings={bookings} rooms={rooms} />

      {unit.notes && (
        <div className="notice notice-gray mt-6 text-muted-foreground">
          <p className="notice-label">Notes</p>
          <p className="whitespace-pre-wrap text-foreground/80">{unit.notes}</p>
        </div>
      )}
    </div>
  );
}

function RoomsCard({
  unitId,
  rooms,
  occupiedRoomIds,
}: {
  unitId: string;
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
        <h2 className="eyebrow">
          Rooms
        </h2>
        <span className="text-xs text-muted-foreground">
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
              <thead className="ff-thead">
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
                  <th className="px-3 py-2.5 text-right font-semibold">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-accent">
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
                      {/* From its bookings (#158), the service's word for
                          tonight; the hand-set "occupied" no longer counts. */}
                      <RoomStatusBadge
                        status={(r.status_now ?? r.status) as RoomStatus}
                        occupied={r.status_now ? false : occupiedRoomIds.has(r.id)}
                      />
                      {r.occupants_tonight ? (
                        <span className="ml-2 font-mono text-[0.65rem] text-muted-foreground">
                          {r.occupants_tonight}/{r.capacity}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      <AmenityChips room={r} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                      {fmtCost(r.cost_per_night)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <EditRoomDrawer unitId={unitId} room={r} />
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
        <h2 className="eyebrow">
          Bookings
        </h2>
        <span className="text-xs text-muted-foreground">
          {sorted.length} upcoming / active
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="ff-thead">
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
                      "hover:bg-accent " +
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
                        <span className="eyebrow">
                          Cancelled
                        </span>
                      ) : (
                        <span className="status-mark text-status-green">
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
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className="rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
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
      ? "text-status-yellow"
      : "text-status-green",
    occupied: "text-status-yellow",
    maintenance:
      "text-status-yellow",
    offline: "text-muted-foreground",
  };
  const label =
    status === "available" && occupied
      ? "In use"
      : (ROOM_STATUS_LABELS[status] ?? status);
  return (
    <span
      className={
        "status-mark text-[0.65rem] " +
        (map[status] ?? "text-muted-foreground")
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
