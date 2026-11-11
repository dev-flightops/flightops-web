import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import type { RampPhotoResponse, RampPhotoType } from "@/lib/api/types";
import { localDateTime } from "@/lib/format/local-time";

const TYPE_LABEL: Record<RampPhotoType, string> = {
  secured_load: "Secured load",
  hazmat_placard: "Hazmat placard",
  damage_documentation: "Damage",
  general: "General",
};

/**
 * The ramp's photos of this flight's load, on its manifest (LOG-43, 10/24:
 * "the ability for the rampers to be able to upload a photo of the plane
 * loaded and have that picture attached to manifest"). The ramp takes them
 * on its own page; here they are seen with the load they show.
 */
export function RampPhotos({
  flightId,
  photos,
  zone,
  canAdd,
}: {
  flightId: string;
  photos: RampPhotoResponse[];
  zone: string;
  canAdd: boolean;
}) {
  return (
    <section id="photos" aria-label="Ramp photos" className="scroll-mt-28">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="eyebrow">Ramp photos</h2>
          <span className="text-xs text-muted-foreground">
            {photos.length === 1 ? "1 photo" : `${photos.length} photos`}
          </span>
        </div>
        {canAdd ? (
          <Link href={`/ramper/${flightId}/photos`} className={linkCaps}>
            Add photos <span aria-hidden>›</span>
          </Link>
        ) : null}
      </div>
      {photos.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          No photos of the load yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
              {/* Through /api/ramp-photos: an <img> can't send the bearer token. */}
              <a href={`/api/ramp-photos/${p.id}`} target="_blank" rel="noreferrer" className="block">
                <img
                  src={`/api/ramp-photos/${p.id}`}
                  alt={`${TYPE_LABEL[p.photo_type] ?? "Photo"} of the load`}
                  className="h-32 w-full object-cover"
                />
              </a>
              <div className="px-2 py-1.5 text-xs">
                <div className="font-semibold text-foreground">{TYPE_LABEL[p.photo_type] ?? p.photo_type}</div>
                <div className="text-muted-foreground">
                  {[p.uploaded_by_name, p.created_at ? localDateTime(p.created_at, zone) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {p.notes ? <div className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{p.notes}</div> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
