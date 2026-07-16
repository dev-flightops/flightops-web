"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createFuelOrder } from "@/lib/api/ground";

/**
 * /fuel/orders/new server action. Validates with zod, calls
 * POST /ground/fuel/orders, redirects to the new order's detail page.
 */

// M2-C-3 — per-side gallons. The form always sends both left + right;
// zod parses each independently, then we validate that at least one is
// > 0 so the sum is a real order. Backend rejects any mismatch between
// the sum and a caller-supplied total (we never send a total here
// anymore — backend computes it).
const nonNegativeGallons = z
  .string()
  .transform((v) => Number(v))
  .refine((v) => Number.isFinite(v) && v >= 0, {
    message: "Gallons must be 0 or more",
  });

const Schema = z
  .object({
    n_number: z
      .string()
      .trim()
      .min(1, "Tail number is required")
      .max(20),
    base_code: z
      .string()
      .trim()
      .min(2, "Base code must be 2-10 characters")
      .max(10),
    supplier_id: z.string().uuid("Pick a supplier"),
    fuel_type_id: z.string().uuid("Pick a fuel type"),
    requested_left_gallons: nonNegativeGallons,
    requested_right_gallons: nonNegativeGallons,
    requested_fuel_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Requested date is required"),
    special_instructions: z
      .string()
      .max(2000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine(
    (v) => v.requested_left_gallons + v.requested_right_gallons > 0,
    {
      message: "Left + right gallons must sum to more than 0",
      path: ["requested_left_gallons"],
    },
  );

export type NewFuelOrderState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createFuelOrderAction(
  _prev: NewFuelOrderState,
  formData: FormData,
): Promise<NewFuelOrderState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  let orderId: string;
  try {
    const created = await createFuelOrder({
      n_number: parsed.data.n_number,
      base_code: parsed.data.base_code,
      supplier_id: parsed.data.supplier_id,
      fuel_type_id: parsed.data.fuel_type_id,
      requested_left_gallons: parsed.data.requested_left_gallons,
      requested_right_gallons: parsed.data.requested_right_gallons,
      requested_fuel_date: parsed.data.requested_fuel_date,
      special_instructions: parsed.data.special_instructions ?? null,
    });
    orderId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      if (err.status === 404) {
        return {
          status: "field-errors",
          errors: {
            supplier_id:
              "The supplier or fuel type isn't in your directory anymore.",
          },
        };
      }
      if (err.status === 409) {
        return {
          status: "field-errors",
          errors: {
            supplier_id:
              "That supplier is inactive — pick another supplier.",
          },
        };
      }
      return {
        status: "api-error",
        message: `Couldn't place the order (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't place the order. Try again in a moment.",
    };
  }

  redirect(`/fuel/orders/${orderId}`);
}
