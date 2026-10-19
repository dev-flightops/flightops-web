"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { cancelWaiting, createWaiting } from "@/lib/api/manifest";

export interface WaitingFormState {
  status: "idle" | "ok" | "error";
  message?: string;
  /** What was sent, so a refused entry is shown again as typed. */
  values?: Record<string, string>;
  /** Bumped on every completed submit; the form remounts on it. */
  attempt: number;
}

const _icao = (label: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,4}$/, `Enter the ${label} as a 3- or 4-letter airport code.`);

const _schema = z.object({
  station_icao: _icao("station"),
  destination_icao: _icao("destination"),
  kind: z.enum(["bypass_mail", "priority_mail", "first_class", "express_mail", "cargo"], {
    message: "Pick mail or cargo.",
  }),
  description: z.string().trim().max(200, "Keep the description under 200 characters."),
  weight_lbs: z
    .string()
    .trim()
    .transform((v) => v.replace(/,/g, ""))
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "Enter the weight in pounds.")
    .refine((v) => Number(v) <= 999999, "The weight can't be over 999,999 lb."),
  pieces: z
    .string()
    .trim()
    .transform((v) => v || "1")
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1, "Pieces is a whole number, 1 or more.")
    .transform(Number),
  shipper: z.string().trim().max(120, "Keep the shipper under 120 characters."),
  consignee: z.string().trim().max(120, "Keep the consignee under 120 characters."),
  notes: z.string().trim().max(2000, "Keep the notes under 2,000 characters."),
});

const FIELDS = [
  "station_icao",
  "destination_icao",
  "kind",
  "description",
  "weight_lbs",
  "pieces",
  "shipper",
  "consignee",
  "notes",
] as const;

function _refusal(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired. Sign in again, then retry.";
    if (err.status === 403) return "Your account can't log waiting mail or freight.";
    if (err.message.includes("describe_the_cargo")) return "Describe the cargo.";
    if (err.message.includes("destination_is_the_station")) return "The destination is the station it's waiting at.";
    if (err.status === 409) return "That entry is no longer waiting. Refresh the page.";
    if (err.status === 422) return "Check the fields and try again.";
    return `That was not saved (HTTP ${err.status}).`;
  }
  return "Could not reach the ops service. Try again in a moment.";
}

/** Log mail or freight waiting at a station (#75). */
export async function createWaitingAction(prev: WaitingFormState, formData: FormData): Promise<WaitingFormState> {
  const values: Record<string, string> = {};
  for (const key of FIELDS) values[key] = String(formData.get(key) ?? "");
  const attempt = prev.attempt + 1;
  const fail = (message: string): WaitingFormState => ({ status: "error", message, values, attempt });
  const parsed = _schema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
  const v = parsed.data;
  if (v.station_icao === v.destination_icao) return fail("The destination is the station it's waiting at.");
  if (v.kind === "cargo" && !v.description) return fail("Describe the cargo.");
  try {
    await createWaiting({
      station_icao: v.station_icao,
      destination_icao: v.destination_icao,
      mail_class: v.kind === "cargo" ? null : v.kind,
      description: v.description || null,
      weight_lbs: v.weight_lbs,
      pieces: v.pieces,
      shipper: v.shipper || null,
      consignee: v.consignee || null,
      notes: v.notes || null,
    });
  } catch (err) {
    return fail(_refusal(err));
  }
  revalidatePath("/manifest/waiting");
  return {
    status: "ok",
    message: `Logged ${Number(v.weight_lbs).toLocaleString()} lb at ${v.station_icao} for ${v.destination_icao}.`,
    // Keep the route for the next entry; clear the rest.
    values: { station_icao: v.station_icao, destination_icao: v.destination_icao, kind: v.kind },
    attempt,
  };
}

/** It went another way: take it off the waiting list. */
export async function cancelWaitingAction(prev: WaitingFormState, formData: FormData): Promise<WaitingFormState> {
  const attempt = prev.attempt + 1;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "This entry lost track of itself. Refresh the page.", attempt };
  try {
    await cancelWaiting(id.data);
  } catch (err) {
    return { status: "error", message: _refusal(err), attempt };
  }
  revalidatePath("/manifest/waiting");
  return { status: "ok", attempt };
}
