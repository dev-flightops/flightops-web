"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  extractBrandingFromUrl,
  updateCompanyProfile,
} from "@/lib/api/auth";

/**
 * /settings/branding server action. Validates hex colors, PATCHes the
 * two brand color fields on company_profile, then revalidates every
 * page that reads the theme (which is every page inside (app) — the
 * BrandThemeStyle wrapper injects the override at the layout root).
 *
 * Empty strings are passed through as ""; the backend's field validator
 * treats them as "clear the override".
 */

const HEX = /^(#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?|)$/;

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
});

export type UpdateBrandingState =
  | { status: "idle" }
  | { status: "saved" }
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

  try {
    await updateCompanyProfile(parsed.data);
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
  return { status: "saved" };
}

// ---- Suggest palette from URL --------------------------------------------

export type ExtractBrandingState =
  | { status: "idle" }
  | { status: "ok"; primary: string; primaryDark: string }
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
