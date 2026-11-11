"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  createFuelSupplier,
  saveSupplierPrice,
  switchOffSupplierPrice,
  updateFuelSupplier,
  type FuelSupplierPayload,
} from "@/lib/api/ground";
import type { FuelSupplierBaseResponse } from "@/lib/api/types";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * The fuel directory, kept in the web (#134): suppliers added and edited,
 * and each supplier's price for a fuel at a base. It could only be changed
 * through the API, so an operator couldn't add a supplier or update a
 * price. As legacy's Fuel → Suppliers, for the directory's keepers
 * (FUEL_CONFIG); the ground service checks that too.
 */

export interface DirectoryResult {
  ok: boolean;
  error?: string;
}

/** A supplier form's fields, as typed. */
export type SupplierFields = Record<keyof FuelSupplierPayload, string>;

/** A price form's fields, as typed; the checkboxes as booleans. */
export interface PriceFields {
  base_code: string;
  fuel_type_id: string;
  price_per_gallon: string;
  effective_from: string;
  effective_to: string;
  notes: string;
  is_contract_rate: boolean;
  is_default: boolean;
}

function refused(err: unknown, fallback: string): DirectoryResult {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return { ok: false, error: "Only the Chief Pilot, the Director of Maintenance, the Director of Operations or an Exec Admin can change the fuel directory." };
    }
    try {
      const message = JSON.parse(err.message)?.detail?.message;
      if (typeof message === "string") return { ok: false, error: message };
    } catch {
      // not JSON: try the field reader below
    }
    const text = refusalText(err);
    if (text) return { ok: false, error: text };
  }
  return { ok: false, error: fallback };
}

const orNull = (value: string) => value.trim() || null;

function supplierPayload(form: SupplierFields): FuelSupplierPayload | string {
  const name = form.name.trim();
  if (!name) return "Give the supplier's name.";
  const email = orNull(form.email);
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) return "The email doesn't look like an address.";
  return {
    name,
    contact_name: orNull(form.contact_name),
    phone: orNull(form.phone),
    sms_phone: orNull(form.sms_phone),
    email,
    cc_emails: orNull(form.cc_emails),
    account_number: orNull(form.account_number),
    billing_terms: orNull(form.billing_terms),
    notes: orNull(form.notes),
    fueled_by: form.fueled_by === "supplier" ? "supplier" : "own_staff",
  };
}

export async function addSupplierAction(form: SupplierFields): Promise<DirectoryResult> {
  const payload = supplierPayload(form);
  if (typeof payload === "string") return { ok: false, error: payload };
  try {
    await createFuelSupplier(payload);
    revalidatePath("/fuel/suppliers");
    return { ok: true };
  } catch (err) {
    return refused(err, "Couldn't add the supplier. Try again in a moment.");
  }
}

/** Every field is sent, so one emptied is cleared, as legacy's edit cleared it. */
export async function updateSupplierAction(
  supplierId: string,
  form: SupplierFields,
  active: boolean,
): Promise<DirectoryResult> {
  const payload = supplierPayload(form);
  if (typeof payload === "string") return { ok: false, error: payload };
  try {
    await updateFuelSupplier(supplierId, { ...payload, is_active: active });
    revalidatePath("/fuel/suppliers");
    return { ok: true };
  } catch (err) {
    return refused(err, "Couldn't save the supplier. Try again in a moment.");
  }
}

/** Saves the supplier's price for a fuel at a base: the same base and
 *  fuel again replaces it, and saving it switches it on. */
export async function savePriceAction(supplierId: string, form: PriceFields): Promise<DirectoryResult> {
  const base = form.base_code.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(base)) return { ok: false, error: "Pick the base." };
  if (!form.fuel_type_id) return { ok: false, error: "Pick the fuel." };
  const priceText = form.price_per_gallon.trim();
  const price = priceText === "" ? null : Number(priceText);
  if (price !== null && !(Number.isFinite(price) && price >= 0)) {
    return { ok: false, error: "The price per gallon is a number of dollars, like 6.875." };
  }
  const from = orNull(form.effective_from);
  const to = orNull(form.effective_to);
  if (from && to && to < from) return { ok: false, error: "The price can't end before it starts." };
  try {
    await saveSupplierPrice(supplierId, {
      base_code: base,
      fuel_type_id: form.fuel_type_id,
      price_per_gallon: price,
      is_contract_rate: form.is_contract_rate,
      effective_from: from,
      effective_to: to,
      is_default: form.is_default,
      notes: orNull(form.notes),
      is_active: true,
    });
    revalidatePath("/fuel/suppliers");
    return { ok: true };
  } catch (err) {
    return refused(err, "Couldn't save the price. Try again in a moment.");
  }
}

/** Switches a price off (kept, as legacy's Disable kept it) or on again
 *  as it was. */
export async function setPriceActiveAction(
  supplierId: string,
  row: FuelSupplierBaseResponse,
  active: boolean,
): Promise<DirectoryResult> {
  try {
    if (active) {
      await saveSupplierPrice(supplierId, {
        base_code: row.base_code,
        fuel_type_id: row.fuel_type_id,
        price_per_gallon: row.price_per_gallon,
        is_contract_rate: row.is_contract_rate,
        effective_from: row.effective_from,
        effective_to: row.effective_to,
        is_default: row.is_default,
        notes: row.notes,
        is_active: true,
      });
    } else {
      await switchOffSupplierPrice(row.id);
    }
    revalidatePath("/fuel/suppliers");
    return { ok: true };
  } catch (err) {
    return refused(err, active ? "Couldn't switch the price back on." : "Couldn't switch the price off.");
  }
}
