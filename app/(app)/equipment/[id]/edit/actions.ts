"use server";

import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { updateGseUnit } from "@/lib/api/ground";
import { validationSummary } from "@/lib/api/validation-errors";

import { EquipmentSchema, fieldErrors, orNull, type EquipmentFormState } from "../../equipment-schema";

/**
 * Edit Equipment (#134): legacy let ground staff fix a unit's details, move
 * it to another station or change its interval; the port had no form. Every
 * field is sent, so one emptied is cleared rather than kept.
 */
export async function updateEquipmentAction(
  unitId: string,
  _prev: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  const parsed = EquipmentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "field-errors", errors: fieldErrors(parsed.error) };
  }
  const d = parsed.data;
  try {
    await updateGseUnit(unitId, {
      name: d.name,
      equipment_type: d.equipment_type,
      make: orNull(d.make),
      model: orNull(d.model),
      serial_number: orNull(d.serial_number),
      year: orNull(d.year),
      station_id: orNull(d.station_id),
      service_interval_days: orNull(d.service_interval_days),
      next_service_date: orNull(d.next_service_date),
      hours_total: d.hours_total,
      manufacturer: orNull(d.manufacturer),
      notes: orNull(d.notes),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return { status: "api-error", message: "Your session expired — please sign in again." };
      if (err.status === 403) {
        return {
          status: "api-error",
          message:
            "Only Ground Ops, the Director of Maintenance, the Director of Operations or an Exec Admin can edit equipment.",
        };
      }
      if (err.status === 404) {
        return err.message.includes("station")
          ? { status: "field-errors", errors: { station_id: "That station isn't in your fleet anymore." } }
          : { status: "api-error", message: "That unit is no longer on file." };
      }
      return {
        status: "api-error",
        message: validationSummary(err) ?? `Couldn't save the unit (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return { status: "api-error", message: "Couldn't save the unit. Try again in a moment." };
  }
  redirect(`/equipment/${unitId}`);
}
