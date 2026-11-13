"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  extractBrandingFromUrl,
  removeHomeImage,
  updateCompanyProfile,
  uploadHomeImage,
} from "@/lib/api/auth";
import type { CompanyProfileResponse } from "@/lib/api/types";

/**
 * /settings/branding server action. Validates hex colors and the Home
 * image link (#118), PATCHes them on company_profile, then revalidates every
 * page that reads the theme (which is every page inside (app) — the
 * BrandThemeStyle wrapper injects the override at the layout root).
 *
 * Empty strings are passed through as ""; the backend's field validator
 * treats them as "clear the override".
 */

const HEX = /^(#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?|)$/;
const IMAGE_LINK = /^(https?:\/\/[^\s"'<>\\]+|)$/;

const Schema = z.object({
  brand_primary_color: z
    .string()
    .trim()
    .max(9)
    .refine((v) => HEX.test(v), "Use #RRGGBB (e.g. #AB2429) or blank to clear"),
  brand_primary_dark_color: z
    .string()
    .trim()
    .max(9)
    .refine((v) => HEX.test(v), "Use #RRGGBB (e.g. #8f1e22) or blank to clear"),
  // The image behind Home (#118): a link, as the backend takes it.
  home_image_url: z
    .string()
    .trim()
    .max(500, "That link is too long (500 characters at most)")
    .refine((v) => IMAGE_LINK.test(v), "Use an https:// link to an image, or blank for none"),
});

export type UpdateBrandingState =
  | { status: "idle" }
  /** With the uploaded picture's time as saved: an address replaces it. */
  | { status: "saved"; homeImageUploadedAt: string | null }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function updateBrandingAction(
  _prev: UpdateBrandingState,
  formData: FormData,
): Promise<UpdateBrandingState> {
  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  let saved: CompanyProfileResponse;
  try {
    saved = await updateCompanyProfile(parsed.data);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      return {
        status: "api-error",
        message: `Couldn't save (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't save. Try again in a moment.",
    };
  }

  // Everything inside (app) reads the theme via the layout's server
  // fetch, so revalidate the layout scope.
  revalidatePath("/", "layout");
  return { status: "saved", homeImageUploadedAt: saved.home_image_uploaded_at ?? null };
}

// ---- The Home picture uploaded from a computer ---------------------------
//
// Greg, 13 Nov: a link or an upload, both possible. The browser makes the
// picture small first (lib/images/downscale); the auth service checks it,
// keeps it as a JPEG in place of any link, and a saved link replaces it.

export type HomeImageResult =
  | { ok: true; uploadedAt: string | null }
  | { ok: false; error: string };

export async function uploadHomeImageAction(formData: FormData): Promise<HomeImageResult> {
  const image = formData.get("image");
  if (!(image instanceof Blob) || image.size === 0) {
    return { ok: false, error: "Choose a picture first." };
  }
  try {
    const profile = await uploadHomeImage(image, image instanceof File && image.name ? image.name : "home.jpg");
    revalidatePath("/", "layout");
    return { ok: true, uploadedAt: profile.home_image_uploaded_at ?? null };
  } catch (err) {
    return { ok: false, error: homeImageError(err) };
  }
}

export async function removeHomeImageAction(): Promise<HomeImageResult> {
  try {
    await removeHomeImage();
  } catch (err) {
    return { ok: false, error: homeImageError(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true, uploadedAt: null };
}

const HOME_IMAGE_REFUSALS: Record<string, string> = {
  content_type_must_be_image: "That file isn't a picture. Choose a JPEG, PNG or WebP photo.",
  image_must_be_jpeg_png_webp_or_gif:
    "That picture is HEIC, which most browsers can't show. Save it as a JPEG, then upload it.",
  image_too_large: "That picture has too many pixels to use. Choose a smaller one.",
  image_unreadable: "That picture couldn't be read. Save it again as a JPEG, then upload it.",
};

function homeImageError(err: unknown): string {
  if (!(err instanceof ApiError)) return "Couldn't save the picture. Try again in a moment.";
  if (err.status === 401) return "Your session expired — please sign in again.";
  if (err.status === 403) return "Only an Exec Admin or Director of Operations can change the Home picture.";
  if (err.status === 413) return "That picture is too large to send. Choose a smaller one.";
  let detail: unknown;
  try {
    detail = (JSON.parse(err.message) as { detail?: unknown }).detail;
  } catch {
    detail = undefined;
  }
  if (typeof detail === "string" && HOME_IMAGE_REFUSALS[detail]) return HOME_IMAGE_REFUSALS[detail];
  return `Couldn't save the picture (HTTP ${err.status}). Try again in a moment.`;
}

// ---- Suggest palette from URL --------------------------------------------

export type ExtractBrandingState =
  | { status: "idle" }
  | { status: "ok"; primary: string; primaryDark: string; homeImage: string | null }
  | { status: "error"; message: string };

export async function extractBrandingAction(
  _prev: ExtractBrandingState,
  formData: FormData,
): Promise<ExtractBrandingState> {
  const url = String(formData.get("url") ?? "").trim();
  if (!url) {
    return { status: "error", message: "Enter a website URL." };
  }
  try {
    const result = await extractBrandingFromUrl(url);
    return {
      status: "ok",
      primary: result.suggested_primary,
      primaryDark: result.suggested_primary_dark,
      homeImage: result.suggested_home_image_url ?? null,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 422) {
        return {
          status: "error",
          message: err.message || "Couldn't extract a color from that URL.",
        };
      }
      if (err.status === 401) {
        return {
          status: "error",
          message: "Your session expired — please sign in again.",
        };
      }
      return {
        status: "error",
        message: `Couldn't reach the extractor (HTTP ${err.status}).`,
      };
    }
    return {
      status: "error",
      message: "Couldn't reach the extractor. Try again in a moment.",
    };
  }
}
