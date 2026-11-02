"use server";

import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { validationSummary } from "@/lib/api/validation-errors";
import { createGseUnit } from "@/lib/api/ground";

import { EquipmentSchema, fieldErrors, orNull, type EquipmentFormState } from "../equipment-schema";

/**
 * Add Equipment form action (M2-G-39b).
 *
 * POSTs to `/ground/gse`. The optional `station_id` ties the unit to
 * a known Station; rejected with 404 if it doesn't belong to the
 * tenant. Successful create redirects to the new unit's detail page.
 */

export type NewEquipmentState = EquipmentFormState;

export async function createEquipmentAction(
  _prev: NewEquipmentState,
  formData: FormData,
): Promise<NewEquipmentState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = EquipmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "field-errors", errors: fieldErrors(parsed.error) };
  }

  let unitId: string;
  try {
    const created = await createGseUnit({
      name: parsed.data.name,
      equipment_type: parsed.data.equipment_type,
      make: orNull(parsed.data.make),
      model: orNull(parsed.data.model),
      serial_number: orNull(parsed.data.serial_number),
      year: orNull(parsed.data.year),
      station_id: orNull(parsed.data.station_id),
      service_interval_days: orNull(parsed.data.service_interval_days),
      next_service_date: orNull(parsed.data.next_service_date),
      hours_total: parsed.data.hours_total,
      manufacturer: orNull(parsed.data.manufacturer),
      notes: orNull(parsed.data.notes),
    });
    unitId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      if (err.status === 403) {
        return {
          status: "api-error",
          message:
            "Only Ground Ops, the Director of Maintenance, the Director of Operations or an Exec Admin can add equipment.",
        };
      }
      if (err.status === 404) {
        return {
          status: "field-errors",
          errors: { station_id: "That station isn't in your fleet anymore." },
        };
      }
      return {
        status: "api-error",
        message: validationSummary(err) ?? `Couldn't add the unit (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't add the unit. Try again in a moment.",
    };
  }

  redirect(`/equipment/${unitId}`);
}
