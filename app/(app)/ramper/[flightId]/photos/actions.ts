"use server";

import { revalidatePath } from "next/cache";

import { deleteRampPhoto, uploadRampPhoto } from "@/lib/api/ground";
import { ApiError } from "@/lib/api/client";
import { MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

export type UploadState =
  | { status: "idle" }
  | { status: "ok"; photoId: string }
  | { status: "error"; message: string };

/** Server action: multipart upload for the ramp photo form. */
export async function uploadRampPhotoAction(
  flightId: string,
  _prev: UploadState,
  form: FormData,
): Promise<UploadState> {
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { status: "error", message: "Pick a photo before uploading." };
  }
  try {
    const created = await uploadRampPhoto(flightId, form);
    revalidatePath(`/ramper/${flightId}/photos`);
    return { status: "ok", photoId: created.id };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return {
          status: "error",
          message:
            "Only Ground Ops, dispatchers, the Chief Pilot, the Director of Operations or an Exec Admin can upload ramp photos.",
        };
      }
      if (err.status === 413) {
        return { status: "error", message: `Photos over ${MAX_UPLOAD_LABEL} can't be uploaded yet.` };
      }
      if (err.status === 422 && err.message.includes("photo_must_be_jpeg_png_webp_or_gif")) {
        return {
          status: "error",
          message: "HEIC photos can't be shown in most browsers. Export it as JPEG and upload that.",
        };
      }
      if (err.status === 422 && err.message.includes("content_type_must_be_image")) {
        return {
          status: "error",
          message: "That file isn't a photo. Use a JPEG, PNG, WebP or GIF image.",
        };
      }
      if (err.status === 422) return { status: "error", message: err.message || "Invalid photo." };
      if (err.status === 404) return { status: "error", message: "Flight not found." };
      return { status: "error", message: `Upload failed (${err.status}).` };
    }
    return { status: "error", message: "Upload failed. Try again." };
  }
}

/** Server action: hard delete a photo. */
export async function deleteRampPhotoAction(
  flightId: string,
  photoId: string,
): Promise<void> {
  await deleteRampPhoto(photoId);
  revalidatePath(`/ramper/${flightId}/photos`);
}
