"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { SCHEDULE_TAG_LABEL_MAX, SCHEDULE_TAG_TONES, type ScheduleTagTone } from "@/lib/api/crew-calendar";
import { createMxTag, paintMxCells, updateMxTag } from "@/lib/api/mx-roster";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * The Mechanic Roster from the web (#178): its own day tags, and painting
 * them on mechanics' days. The same rules as the crew calendar's tags.
 */

export type RosterResult = { ok: true } | { ok: false; error: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function messageFor(err: unknown, verb: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only maintenance, the Director of Maintenance or an Exec Admin can change the roster.";
    }
    return refusalText(err) ?? `Couldn't ${verb} (HTTP ${err.status}). Try again.`;
  }
  return `Couldn't ${verb}. Try again.`;
}

function tagLabel(raw: string): string | { error: string } {
  const label = raw.split(/\s+/).filter(Boolean).join(" ");
  if (!label) return { error: "Give the tag a label." };
  if (label.length > SCHEDULE_TAG_LABEL_MAX) return { error: `Keep the label to ${SCHEDULE_TAG_LABEL_MAX} characters.` };
  return label;
}

function isTone(tone: string): tone is ScheduleTagTone {
  return (SCHEDULE_TAG_TONES as readonly string[]).includes(tone);
}

export async function createRosterTagAction(rawLabel: string, tone: string): Promise<RosterResult> {
  const label = tagLabel(rawLabel);
  if (typeof label !== "string") return { ok: false, error: label.error };
  if (!isTone(tone)) return { ok: false, error: "Pick a colour." };
  try {
    await createMxTag({ label, tone });
  } catch (err) {
    return { ok: false, error: messageFor(err, "add the tag") };
  }
  revalidatePath("/maintenance/roster");
  return { ok: true };
}

export async function updateRosterTagAction(
  tagId: string,
  patch: { label?: string; tone?: string; is_active?: boolean },
): Promise<RosterResult> {
  const body: { label?: string; tone?: ScheduleTagTone; is_active?: boolean } = {};
  if (patch.label !== undefined) {
    const label = tagLabel(patch.label);
    if (typeof label !== "string") return { ok: false, error: label.error };
    body.label = label;
  }
  if (patch.tone !== undefined) {
    if (!isTone(patch.tone)) return { ok: false, error: "Pick a colour." };
    body.tone = patch.tone;
  }
  if (patch.is_active !== undefined) body.is_active = patch.is_active;
  try {
    await updateMxTag(tagId, body);
  } catch (err) {
    return { ok: false, error: messageFor(err, "change the tag") };
  }
  revalidatePath("/maintenance/roster");
  return { ok: true };
}

/** Paint a run of one mechanic's days with a tag, or clear them (null). */
export async function paintRosterDaysAction(
  userId: string,
  startDate: string,
  endDate: string,
  tagId: string | null,
): Promise<RosterResult> {
  if (!ISO_DAY.test(startDate) || !ISO_DAY.test(endDate)) return { ok: false, error: "Pick the days again." };
  const [start, end] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  try {
    await paintMxCells({ user_id: userId, start_date: start, end_date: end, tag_id: tagId });
  } catch (err) {
    return { ok: false, error: messageFor(err, tagId ? "paint those days" : "clear those days") };
  }
  revalidatePath("/maintenance/roster");
  return { ok: true };
}
