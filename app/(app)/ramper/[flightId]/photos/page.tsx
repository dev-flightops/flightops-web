import Link from "next/link";
import { notFound } from "next/navigation";

import { getFlight } from "@/lib/api/ops";
import { ApiError } from "@/lib/api/client";

/**
 * /ramper/[flightId]/photos — ramp turnaround photo capture.
 *
 * Mirrors the Photos section of legacy `templates/ramper/flight_detail.html`
 * (lines 291–345). The full 436-line legacy detail page bundled photos
 * with turnaround timing + task checklist + notes + messaging; per
 * Option B of the M2 review this ships the photo-capture-only slice
 * so operators have a working affordance without waiting on the full
 * per-flight detail page.
 *
 * Layout: back link → minimal flight header (flight # · N-number ·
 * aircraft type · status badge) → Upload form (Photo Type select +
 * mobile-camera file input) → gallery → required-photo checklist.
 *
 * Backend not shipped — no ramp-service photo endpoints or R2 bucket
 * exist yet. All upload actions are disabled with a milestone
 * tooltip; the gallery renders empty and the required-photo
 * checklist shows all three items as missing until Marc's M2 ramp
 * photo backend lands.
 */

const PHOTO_TYPES = [
  { value: "secured_load", label: "Secured Load", required: true },
  { value: "hazmat_placard", label: "Hazmat Placard", required: true },
  { value: "damage_documentation", label: "Damage Documentation", required: true },
  { value: "general", label: "General", required: false },
] as const;

const BACKEND_HINT =
  "Ramp photo upload ships with the ground-service ramp-photos backend (M2)";

export default async function RamperPhotosPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await params;

  let flight;
  try {
    flight = await getFlight(flightId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const photos: never[] = []; // Backend not shipped.

  return (
    <div
      className="mx-auto w-full max-w-[600px] px-3 pb-24 pt-3"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <Link
        href="/ramper"
        className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        Back to Ramp Worklist
      </Link>

      <div
        className="mb-3 rounded-2xl border-2 border-border bg-card p-4"
        style={{
          borderLeftWidth: 5,
          borderLeftColor: flight.status === "completed" ? "#60a5fa" : "#34d399",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">
              {flight.flight_number ?? "—"}
            </h1>
            <p className="mt-0.5 text-sm font-semibold text-status-blue">
              {flight.aircraft?.tail_number ?? "—"}
              {flight.aircraft?.model && ` · ${flight.aircraft.model}`}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {flight.origin ?? "?"} → {flight.destination ?? "?"}
            </p>
          </div>
          <span
            className={
              "rounded-lg px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.04em] " +
              statusBadgeClass(flight.status)
            }
          >
            {flight.status}
          </span>
        </div>
      </div>

      <div className="mb-2 mt-5 flex items-center gap-1.5 px-1 text-[0.75rem] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
          <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
        </svg>
        Photos ({photos.length})
      </div>

      <div className="rounded-2xl border-2 border-border bg-card p-4">
        {/* Upload form — disabled until backend lands. */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Photo Type
          </label>
          <select
            name="photo_type"
            disabled
            title={BACKEND_HINT}
            className="w-full cursor-not-allowed rounded-xl border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-100"
          >
            {PHOTO_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <input
              type="file"
              name="photo"
              accept="image/*"
              capture="environment"
              disabled
              title={BACKEND_HINT}
              className="w-full cursor-not-allowed rounded-xl border border-border bg-background px-2 py-2 text-xs disabled:opacity-100"
            />
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            aria-label="Upload photo"
            title={BACKEND_HINT}
            className="flex h-[52px] w-[52px] flex-shrink-0 cursor-not-allowed items-center justify-center rounded-2xl border-2 border-status-blue/30 bg-status-blue/15 text-status-blue disabled:opacity-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
              <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
            </svg>
          </button>
        </div>

        {photos.length === 0 ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            No photos yet
          </p>
        ) : null}

        {/* Required photo checklist — mirrors legacy 'Required Photos'. */}
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Required Photos
          </div>
          <ul className="space-y-1 text-sm">
            {PHOTO_TYPES.filter((t) => t.required).map((t) => (
              <li key={t.value} className="flex items-center gap-2 text-status-red">
                <span aria-hidden>✗</span>
                {t.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-status-blue/15 text-status-blue";
    case "released":
      return "bg-status-yellow/15 text-status-yellow";
    case "cancelled":
      return "bg-status-red/15 text-status-red";
    default:
      return "bg-status-green/15 text-status-green";
  }
}
