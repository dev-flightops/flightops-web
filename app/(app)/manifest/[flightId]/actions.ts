"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  addCargo,
  addPax,
  createManifest,
  deleteCargo,
  deletePax,
  lockManifest,
  MAIL_CLASSES,
  mailDescription,
  TICKET_TYPES,
  updateCargo,
  updatePax,
  type CargoInput,
  type MailClass,
  type PaxInput,
  type TicketType,
} from "@/lib/api/manifest";

export interface ManifestFormState {
  status: "idle" | "ok" | "error";
  message?: string;
  /** What was sent, so a refused entry is shown again as typed. */
  values?: Record<string, string>;
  /** Bumped on every completed submit; forms remount on it. */
  attempt: number;
}

const _id = z.string().uuid();

/** Pounds as typed: a non-negative number under the column's ceiling, so
 *  a slip of the finger is refused here rather than overflowing there. */
const _lbs = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}.`)
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, `Enter the ${label} in pounds.`)
    .refine((v) => Number(v) <= max, `The ${label} can't be over ${max.toLocaleString()} lb.`);

const _optional = (max: number, label: string) =>
  z.string().trim().max(max, `Keep the ${label} under ${max.toLocaleString()} characters.`);

const _paxSchema = z.object({
  first_name: z.string().trim().min(1, "Enter the first name.").max(80, "Keep the first name under 80 characters."),
  last_name: z.string().trim().min(1, "Enter the last name.").max(80, "Keep the last name under 80 characters."),
  weight_lbs: _lbs("passenger's weight", 9999),
  baggage_lbs: z.string().trim().transform((v) => v || "0").pipe(_lbs("baggage weight", 9999)),
  seat_number: _optional(10, "seat"),
  ticket_type: z.enum(TICKET_TYPES as [TicketType, ...TicketType[]]),
  contact_phone: _optional(32, "phone number"),
  contact_email: _optional(160, "email").refine(
    (v) => !v || z.string().email().safeParse(v).success,
    "Enter a valid email, or leave it blank.",
  ),
  notes: _optional(2000, "notes"),
});

const _pieces = z
  .string()
  .trim()
  .transform((v) => v || "1")
  .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100000, "Pieces is a whole number, 1 or more.")
  .transform(Number);

const _mailSchema = z.object({
  mail_class: z.enum(MAIL_CLASSES as [MailClass, ...MailClass[]], { message: "Pick the mail class." }),
  weight_lbs: _lbs("mail weight", 999999),
  pieces: _pieces,
  notes: _optional(2000, "notes"),
});

const _cargoSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Describe the cargo.")
    .max(200, "Keep the description under 200 characters."),
  weight_lbs: _lbs("cargo weight", 999999),
  pieces: _pieces,
  tracking_number: _optional(80, "tracking number"),
  shipper: _optional(120, "shipper"),
  consignee: _optional(120, "consignee"),
  hazmat_notes: _optional(2000, "hazmat class or notes"),
  notes: _optional(2000, "notes"),
});

const PAX_FIELDS = [
  "first_name",
  "last_name",
  "weight_lbs",
  "baggage_lbs",
  "seat_number",
  "ticket_type",
  "contact_phone",
  "contact_email",
  "notes",
  "is_crew",
  "is_unaccompanied_minor",
] as const;

const FREIGHT_FIELDS = [
  "mail_class",
  "description",
  "weight_lbs",
  "pieces",
  "tracking_number",
  "shipper",
  "consignee",
  "is_hazmat",
  "hazmat_notes",
  "notes",
] as const;

function _values(formData: FormData, fields: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of fields) out[key] = String(formData.get(key) ?? "");
  return out;
}

function _page(flightId: string): string {
  return `/manifest/${flightId}`;
}

/** What a refused change tells the person who made it. */
function _refusal(err: unknown, denied: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired. Sign in again, then retry.";
    if (err.status === 403) return denied;
    if (err.status === 404) return "This manifest has changed since the page loaded. Refresh the page.";
    if (err.status === 409) return "This manifest is locked, so it can't be changed.";
    if (err.status === 422) return "Check the fields and try again.";
    return `That was not saved (HTTP ${err.status}).`;
  }
  return "Could not reach the ops service. Try again in a moment.";
}

const _ANY_STAFF = "Your account can't change manifests.";

/** Add a passenger, or save one being edited (`pax_id`). */
export async function savePaxAction(
  prev: ManifestFormState,
  formData: FormData,
): Promise<ManifestFormState> {
  const values = _values(formData, PAX_FIELDS);
  const attempt = prev.attempt + 1;
  const fail = (message: string): ManifestFormState => ({ status: "error", message, values, attempt });

  const flightId = _id.safeParse(formData.get("flight_id"));
  const paxId = String(formData.get("pax_id") ?? "");
  if (!flightId.success || (paxId && !_id.safeParse(paxId).success)) {
    return fail("This form lost track of its flight. Refresh the page.");
  }
  const parsed = _paxSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
  const v = parsed.data;

  const pax: PaxInput = {
    first_name: v.first_name,
    last_name: v.last_name,
    weight_lbs: v.weight_lbs,
    baggage_lbs: v.baggage_lbs,
    seat_number: v.seat_number.toUpperCase() || null,
    ticket_type: v.ticket_type,
    is_crew: values.is_crew === "on",
    is_unaccompanied_minor: values.is_unaccompanied_minor === "on",
    contact_phone: v.contact_phone || null,
    contact_email: v.contact_email || null,
    notes: v.notes || null,
  };
  try {
    if (paxId) await updatePax(paxId, pax);
    else await addPax(flightId.data, pax);
  } catch (err) {
    return fail(_refusal(err, _ANY_STAFF));
  }

  revalidatePath(_page(flightId.data));
  const who = `${pax.first_name} ${pax.last_name}`;
  return { status: "ok", message: paxId ? `Saved ${who}.` : `Added ${who}.`, attempt };
}

/** Add a cargo or mail line, or save one being edited (`cargo_id`).
 *
 *  A mail line's form is legacy's: class, weight, pieces, notes. Its
 *  description is "USPS <class>" unless somebody wrote their own, which an
 *  edit keeps. An edit sends only what its form shows. */
export async function saveFreightAction(
  prev: ManifestFormState,
  formData: FormData,
): Promise<ManifestFormState> {
  const values = _values(formData, FREIGHT_FIELDS);
  const attempt = prev.attempt + 1;
  const fail = (message: string): ManifestFormState => ({ status: "error", message, values, attempt });

  const flightId = _id.safeParse(formData.get("flight_id"));
  const cargoId = String(formData.get("cargo_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!flightId.success || (cargoId && !_id.safeParse(cargoId).success) || !["mail", "cargo"].includes(kind)) {
    return fail("This form lost track of its flight. Refresh the page.");
  }

  let line: CargoInput;
  if (kind === "mail") {
    const parsed = _mailSchema.safeParse(values);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
    const v = parsed.data;
    const was = String(formData.get("current_description") ?? "");
    const wasClass = String(formData.get("current_mail_class") ?? "");
    const ownWords =
      was && !(MAIL_CLASSES as readonly string[]).some((c) => c === wasClass && was === mailDescription(c as MailClass));
    line = {
      description: ownWords ? was : mailDescription(v.mail_class),
      weight_lbs: v.weight_lbs,
      pieces: v.pieces,
      mail_class: v.mail_class,
      is_hazmat: false,
      hazmat_notes: null,
      shipper: null,
      consignee: null,
      tracking_number: null,
      notes: v.notes || null,
    };
  } else {
    const parsed = _cargoSchema.safeParse(values);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
    const v = parsed.data;
    const hazmat = values.is_hazmat === "on";
    line = {
      description: v.description,
      weight_lbs: v.weight_lbs,
      pieces: v.pieces,
      mail_class: null,
      is_hazmat: hazmat,
      hazmat_notes: hazmat ? v.hazmat_notes || null : null,
      shipper: v.shipper || null,
      consignee: v.consignee || null,
      tracking_number: v.tracking_number || null,
      notes: v.notes || null,
    };
  }

  try {
    if (!cargoId) {
      await addCargo(flightId.data, line);
    } else if (kind === "mail") {
      const { description, weight_lbs, pieces, mail_class, notes } = line;
      await updateCargo(cargoId, { description, weight_lbs, pieces, mail_class, notes });
    } else {
      await updateCargo(cargoId, line);
    }
  } catch (err) {
    return fail(_refusal(err, _ANY_STAFF));
  }

  revalidatePath(_page(flightId.data));
  const what = kind === "mail" ? "mail" : line.description;
  return { status: "ok", message: cargoId ? `Saved ${what}.` : `Added ${what}.`, attempt };
}

/** Take a passenger (`kind` pax) or a cargo or mail line off the manifest. */
export async function removeLineAction(
  prev: ManifestFormState,
  formData: FormData,
): Promise<ManifestFormState> {
  const attempt = prev.attempt + 1;
  const flightId = _id.safeParse(formData.get("flight_id"));
  const lineId = _id.safeParse(formData.get("line_id"));
  const kind = String(formData.get("kind") ?? "");
  if (!flightId.success || !lineId.success || !["pax", "cargo"].includes(kind)) {
    return { status: "error", message: "This row lost track of its flight. Refresh the page.", attempt };
  }
  try {
    if (kind === "pax") await deletePax(lineId.data);
    else await deleteCargo(lineId.data);
  } catch (err) {
    return { status: "error", message: _refusal(err, _ANY_STAFF), attempt };
  }
  revalidatePath(_page(flightId.data));
  return { status: "ok", attempt };
}

/** Start the flight's manifest. */
export async function createManifestAction(
  prev: ManifestFormState,
  formData: FormData,
): Promise<ManifestFormState> {
  const attempt = prev.attempt + 1;
  const flightId = _id.safeParse(formData.get("flight_id"));
  if (!flightId.success) return { status: "error", message: "Refresh the page and try again.", attempt };
  try {
    await createManifest(flightId.data);
  } catch (err) {
    // Somebody else started it first: theirs is the manifest, so show it.
    if (!(err instanceof ApiError && err.status === 409)) {
      return { status: "error", message: _refusal(err, _ANY_STAFF), attempt };
    }
  }
  revalidatePath(_page(flightId.data));
  return { status: "ok", attempt };
}

/** Make the manifest final. The API admits only legacy's close-boarding
 *  roles (MANIFEST_LOCKERS) and there is no unlock. */
export async function lockManifestAction(
  prev: ManifestFormState,
  formData: FormData,
): Promise<ManifestFormState> {
  const attempt = prev.attempt + 1;
  const flightId = _id.safeParse(formData.get("flight_id"));
  if (!flightId.success) return { status: "error", message: "Refresh the page and try again.", attempt };
  try {
    await lockManifest(flightId.data);
  } catch (err) {
    return {
      status: "error",
      message: _refusal(
        err,
        "Only Ground Ops, Reservations Agents, Dispatchers, the Chief Pilot, the Director of Operations and Exec Admins lock manifests.",
      ),
      attempt,
    };
  }
  revalidatePath(_page(flightId.data));
  return { status: "ok", attempt };
}
