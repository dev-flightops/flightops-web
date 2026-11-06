"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { deferSquawk, inspectSquawk, rejectSquawkSignOff, signOffSquawk } from "@/lib/api/maintenance";
import { refusalText } from "@/lib/api/validation-errors";

/** Return to Service from the web (#172). The rules are maintenance-service's. */

export type RtsResult = { ok: true } | { ok: false; message: string };

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only maintenance, the Director of Maintenance or an Exec Admin can sign an aircraft back into service.";
    }
    if (err.status === 404) return "That squawk isn't on file any more — refresh the page.";
    return refusalText(err) ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

function refresh(aircraftId?: string): void {
  revalidatePath("/maintenance/rts");
  revalidatePath("/maintenance/squawks");
  revalidatePath("/maintenance");
  revalidatePath("/maintenance/mel");
  revalidatePath("/maintenance/due-list");
  revalidatePath("/maintenance/availability");
  if (aircraftId) revalidatePath(`/maintenance/aircraft/${aircraftId}`);
}

const filled = (message: string) => z.string().trim().min(1, message);

const SignOffSchema = z.object({
  work_notes: filled("Describe the work performed."),
  amt_name: filled("Give the AMT's name."),
  cert_number: filled("Give the FAA certificate number."),
  cert_type: z.enum(["ap", "ia", "repairman"], { errorMap: () => ({ message: "Pick the certificate type." }) }),
  airworthy: z.literal(true, { errorMap: () => ({ message: "Tick the certification to sign." }) }),
  is_rii: z.boolean(),
});

export async function signOffAction(
  squawkId: string,
  aircraftId: string,
  input: z.input<typeof SignOffSchema>,
): Promise<RtsResult> {
  const parsed = SignOffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    await signOffSquawk(squawkId, parsed.data);
  } catch (err) {
    return { ok: false, message: refusal(err, "sign it off") };
  }
  refresh(aircraftId);
  return { ok: true };
}

const InspectSchema = z.object({
  inspector_name: filled("Give the inspector's name."),
  cert_number: filled("Give the FAA certificate number."),
  notes: z
    .string()
    .trim()
    .transform((v) => v || null),
  confirmed: z.literal(true, { errorMap: () => ({ message: "Confirm the inspection to sign." }) }),
});

export async function inspectAction(
  squawkId: string,
  aircraftId: string,
  input: z.input<typeof InspectSchema>,
): Promise<RtsResult> {
  const parsed = InspectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    await inspectSquawk(squawkId, parsed.data);
  } catch (err) {
    return { ok: false, message: refusal(err, "sign the inspection") };
  }
  refresh(aircraftId);
  return { ok: true };
}

export async function rejectAction(squawkId: string, aircraftId: string, reason: string): Promise<RtsResult> {
  const cleaned = reason.trim();
  if (!cleaned) return { ok: false, message: "Say why it's being rejected." };
  try {
    await rejectSquawkSignOff(squawkId, cleaned);
  } catch (err) {
    return { ok: false, message: refusal(err, "reject it") };
  }
  refresh(aircraftId);
  return { ok: true };
}

const DeferSchema = z.object({
  defer_type: z.enum(["mel", "dmi"]),
  reason: filled("Give the reason for the deferral."),
  mel_category: z.enum(["A", "B", "C", "D"]),
  ata_chapter: z.string().trim().max(10, "The ATA chapter is up to 10 characters."),
  reference: z.string().trim().max(100),
  due_on: z.string().trim(),
});

export async function deferAction(
  squawkId: string,
  aircraftId: string,
  input: z.input<typeof DeferSchema>,
): Promise<RtsResult> {
  const parsed = DeferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { defer_type, reason, mel_category, ata_chapter, reference, due_on } = parsed.data;
  try {
    await deferSquawk(squawkId, {
      defer_type,
      reason,
      mel_category: defer_type === "mel" ? mel_category : null,
      ata_chapter: defer_type === "mel" ? ata_chapter || null : null,
      reference: reference || null,
      due_on: due_on || null,
    });
  } catch (err) {
    return { ok: false, message: refusal(err, "defer it") };
  }
  refresh(aircraftId);
  return { ok: true };
}
