"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createCurrencyItem, deactivateCurrencyItem } from "@/lib/api/ops";

/**
 * M2-C-2 server actions — Add and Deactivate a tenant-scoped
 * currency item. Chief pilot / exec admin only (backend enforces).
 * See flightops-services PR #93 for endpoint contracts.
 */

const CreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Code is required")
      .max(64)
      // Backend stores string(64); keep it kebab/snake compatible for
      // grep-ability in logs. Loose regex — chars allowed everywhere
      // in existing default codes.
      .regex(/^[a-z0-9_.-]+$/i, "Use letters, digits, _, . or -"),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(128),
    regulation: z
      .string()
      .trim()
      .min(1, "Regulation label is required")
      .max(64),
    interval_type: z.enum([
      "annual",
      "semi_annual",
      "medical_hard_expiry",
      "rolling_days",
    ]),
    rolling_days: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0), {
        message: "Rolling days must be a positive integer",
      }),
    rolling_threshold: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0), {
        message: "Threshold must be a positive integer",
      }),
    requires_examiner: z
      .string()
      .optional()
      .transform((v) => v === "on"),
    is_check_event: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .refine(
    (v) =>
      v.interval_type !== "rolling_days" ||
      (v.rolling_days !== null && v.rolling_threshold !== null),
    {
      message: "Rolling days + threshold required for rolling_days items",
      path: ["rolling_days"],
    },
  );

export type CreateCurrencyItemState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createCurrencyItemAction(
  _prev: CreateCurrencyItemState,
  formData: FormData,
): Promise<CreateCurrencyItemState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  try {
    await createCurrencyItem({
      code: parsed.data.code,
      name: parsed.data.name,
      regulation: parsed.data.regulation,
      interval_type: parsed.data.interval_type,
      // Only send rolling fields for rolling items — the backend
      // model_validator rejects them for calendar interval types.
      rolling_days:
        parsed.data.interval_type === "rolling_days"
          ? parsed.data.rolling_days
          : null,
      rolling_threshold:
        parsed.data.interval_type === "rolling_days"
          ? parsed.data.rolling_threshold
          : null,
      requires_examiner: parsed.data.requires_examiner,
      is_check_event: parsed.data.is_check_event,
    });
  } catch (err) {
    return apiToState(err);
  }
  revalidatePath("/compliance/crew-currency");
  return { status: "ok" };
}

export type DeactivateResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function deactivateCurrencyItemAction(
  itemId: string,
): Promise<DeactivateResult> {
  try {
    await deactivateCurrencyItem(itemId);
    revalidatePath("/compliance/crew-currency");
    return { status: "ok" };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return { status: "error", message: "Your session expired — sign in again." };
      }
      if (err.status === 403) {
        return {
          status: "error",
          message: "Can't deactivate a default Part 135 currency item.",
        };
      }
      if (err.status === 404) {
        return { status: "error", message: "That item no longer exists." };
      }
    }
    return { status: "error", message: "Couldn't deactivate. Try again." };
  }
}

function apiToState(err: unknown): CreateCurrencyItemState {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { status: "api-error", message: "Your session expired — sign in again." };
    }
    if (err.status === 403) {
      return {
        status: "api-error",
        message: "You need Chief Pilot or Exec Admin to add currency items.",
      };
    }
    if (err.status === 409) {
      return {
        status: "field-errors",
        errors: { code: "That code is already in use in this tenant." },
      };
    }
    if (err.status === 422) {
      const detail = parseFirstFieldError(err.message);
      return {
        status: "api-error",
        message: detail ? `Please fix: ${detail}` : "Validation failed.",
      };
    }
    return {
      status: "api-error",
      message: `Couldn't create item (HTTP ${err.status}). Try again.`,
    };
  }
  return {
    status: "api-error",
    message: "Couldn't create item. Try again in a moment.",
  };
}

function parseFirstFieldError(message: string): string {
  try {
    const parsed = JSON.parse(message) as {
      detail?: Array<{ loc?: unknown[]; msg?: string }>;
    };
    const first = Array.isArray(parsed.detail) ? parsed.detail[0] : undefined;
    if (!first?.msg) return "";
    const field = Array.isArray(first.loc)
      ? first.loc.filter((p) => p !== "body").join(".")
      : "";
    return field ? `${field} — ${first.msg}` : first.msg;
  } catch {
    return "";
  }
}
