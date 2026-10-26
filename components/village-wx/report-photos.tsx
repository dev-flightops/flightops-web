import type { VillagePhotoRef } from "@/lib/api/types";

/**
 * A village report's photos (#121): visibility, clouds, the runway. Small
 * on the board and the packet; each opens full size in a new tab.
 */
export function ReportPhotos({ photos }: { photos?: VillagePhotoRef[] }) {
  if (!photos?.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2" aria-label="Photos">
      {photos.map((photo, index) => (
        <li key={photo.id}>
          <a
            href={`/api/village-photos/${photo.id}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`Photo ${index + 1} of ${photos.length}, full size in a new tab`}
            className="block border border-border hover:border-primary"
          >
            {/* Served through this app's own route (the bearer token), so
                not next/image. */}
            <img
              src={`/api/village-photos/${photo.id}`}
              alt=""
              loading="lazy"
              width={96}
              height={72}
              className="h-[72px] w-24 object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
