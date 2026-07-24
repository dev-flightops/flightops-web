import Link from "next/link";
import { notFound } from "next/navigation";

import { listRampPhotos } from "@/lib/api/ground";
import { getFlight } from "@/lib/api/ops";
import { ApiError } from "@/lib/api/client";
import type { RampPhotoResponse, RampPhotoType } from "@/lib/api/types";

import { UploadRampPhotoForm } from "./upload-form";

/**
 * /ramper/[flightId]/photos — ramp turnaround photo capture.
 *
 * Live end-to-end against the ground-service ramp-photos backend
 * (flightops-services PR #111). Reads photos via GET
 * /ground/flights/{id}/photos on render, uploads via server action
 * → POST /ground/flights/{id}/photos with revalidatePath.
 *
 * Layout: back link → minimal flight header → upload form →
 * gallery of thumbnails → required-photo checklist (green ✓ /
 * red ✗) based on which types have been uploaded.
 */

const REQUIRED_TYPES: readonly {
  value: RampPhotoType;
  label: string;
}[] = [
  { value: "secured_load", label: "Secured Load" },
  { value: "hazmat_placard", label: "Hazmat Placard" },
  { value: "damage_documentation", label: "Damage Documentation" },
];

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

  let photos: RampPhotoResponse[] = [];
  let photosError: string | null = null;
  try {
    const response = await listRampPhotos(flightId);
    photos = response.items;
  } catch (err) {
    if (err instanceof ApiError) {
      photosError =
        err.status === 403
          ? "You don't have permission to view ramp photos."
          : "Photos unavailable — try refreshing.";
    } else {
      photosError = "Photos unavailable — try refreshing.";
    }
  }

  const uploadedTypes = new Set(photos.map((p) => p.photo_type));

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
        <UploadRampPhotoForm flightId={flightId} />

        {photosError && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
          >
            {photosError}
          </p>
        )}

        {photos.length === 0 && !photosError ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            No photos yet
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-status-blue"
              >
                <img
                  src={p.url}
                  alt={photoTypeLabel(p.photo_type)}
                  className="h-24 w-full object-cover"
                />
                <div className="px-1.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  {photoTypeLabel(p.photo_type)}
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Required Photos
          </div>
          <ul className="space-y-1 text-sm">
            {REQUIRED_TYPES.map((t) => {
              const have = uploadedTypes.has(t.value);
              return (
                <li
                  key={t.value}
                  className={
                    "flex items-center gap-2 " +
                    (have ? "text-status-green" : "text-status-red")
                  }
                >
                  <span aria-hidden>{have ? "✓" : "✗"}</span>
                  {t.label}
                </li>
              );
            })}
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

function photoTypeLabel(t: RampPhotoType): string {
  return t.replace(/_/g, " ");
}
