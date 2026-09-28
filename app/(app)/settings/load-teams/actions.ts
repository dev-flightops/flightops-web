"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  addLoadTeamMember,
  createLoadTeam,
  listLoadTeamMembers,
  removeLoadTeamMember,
  updateLoadTeam,
} from "@/lib/api/ground";
import type { LoadTeamMemberResponse } from "@/lib/api/types";

/**
 * Settings → Load Teams writes (ground-service /load-teams). A team's
 * name, colour, lead and member count also show on /ramp-ops and on the
 * dispatch packet's Load Team panel, so every write refreshes all three.
 *
 * Called directly from client components rather than as form actions:
 * the unit tests run React 18, which has neither useActionState nor
 * function form actions.
 */

export type TeamField = "team_name" | "base_icao" | "color_code" | "notes";

export type TeamFormResult =
  | { status: "ok" }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<TeamField, string>>;
    };

export type ActionResult = { ok: true } | { ok: false; error: string };

function _revalidate() {
  revalidatePath("/settings/load-teams");
  revalidatePath("/ramp-ops");
  revalidatePath("/dispatch");
}

const TeamSchema = z.object({
  team_name: z
    .string()
    .trim()
    .min(1, "Give the team a name.")
    .max(100, "Keep the name under 100 characters."),
  base_icao: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Pick the team's base.")
    .max(10, "Pick the team's base."),
  color_code: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Pick a colour."),
  notes: z.string().trim().max(2000, "Keep notes under 2,000 characters."),
});

const Uuid = z.string().uuid();

function _message(err: unknown, verb: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) return "You don't have permission to manage load teams.";
    return `Couldn't ${verb} (HTTP ${err.status}). Try again.`;
  }
  return `Couldn't ${verb}. Try again.`;
}

/**
 * Create a team, or update one when the form carries `team_id`.
 *
 * `team_lead_user_id` goes by presence. The form only has the field when
 * the lead picker could be offered: "" means no lead, and on an edit an
 * absent field leaves the lead as it is. The people list is Executive
 * Admin only, so a Director of Operations edits a team without it, and
 * must not clear its lead by doing so.
 */
export async function saveTeamAction(formData: FormData): Promise<TeamFormResult> {
  const teamId = formData.get("team_id");
  const parsed = TeamSchema.safeParse({
    team_name: formData.get("team_name") ?? "",
    base_icao: formData.get("base_icao") ?? "",
    color_code: formData.get("color_code") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<TeamField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as TeamField;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }
  if (teamId !== null && !Uuid.safeParse(teamId).success) {
    return { status: "error", message: "That team isn't available — refresh and retry." };
  }
  const leadRaw = formData.get("team_lead_user_id");
  if (leadRaw !== null && leadRaw !== "" && !Uuid.safeParse(leadRaw).success) {
    return { status: "error", message: "Pick the lead from the list." };
  }

  const { team_name, base_icao, color_code, notes } = parsed.data;
  const lead =
    leadRaw === null ? undefined : leadRaw === "" ? null : String(leadRaw);

  try {
    if (teamId === null) {
      await createLoadTeam({
        team_name,
        base_icao,
        color_code,
        notes: notes || null,
        ...(lead ? { team_lead_user_id: lead } : {}),
      });
    } else {
      const saved = await updateLoadTeam(String(teamId), {
        team_name,
        base_icao,
        color_code,
        notes: notes || null,
        ...(lead !== undefined ? { team_lead_user_id: lead } : {}),
      });
      // A ground service from before fix/load-team-edit drops a base
      // change and a null lead without a word. Say so rather than
      // closing the form as if they had saved.
      const unapplied = [
        saved.base_icao !== base_icao && "the base",
        lead === null && saved.team_lead !== null && "removing the lead",
      ].filter(Boolean);
      if (unapplied.length > 0) {
        _revalidate();
        return {
          status: "error",
          message: `Saved, except ${unapplied.join(" and ")}: the server can't change that yet.`,
        };
      }
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return {
        status: "error",
        message: "Check the highlighted fields.",
        fieldErrors: {
          team_name: `${base_icao} already has a team called “${team_name}”.`,
        },
      };
    }
    if (err instanceof ApiError && err.status === 404) {
      return {
        status: "error",
        message:
          "That team, or the lead you picked, no longer exists — refresh and try again.",
      };
    }
    return {
      status: "error",
      message: _message(err, teamId === null ? "create the team" : "save the team"),
    };
  }
  _revalidate();
  return { status: "ok" };
}

export async function setTeamActiveAction(
  teamId: string,
  active: boolean,
): Promise<ActionResult> {
  if (!Uuid.safeParse(teamId).success) {
    return { ok: false, error: "That team isn't available — refresh and retry." };
  }
  try {
    await updateLoadTeam(teamId, { is_active: active });
  } catch (err) {
    return {
      ok: false,
      error: _message(err, active ? "reactivate the team" : "deactivate the team"),
    };
  }
  _revalidate();
  return { ok: true };
}

export async function listMembersAction(
  teamId: string,
): Promise<
  { ok: true; members: LoadTeamMemberResponse[] } | { ok: false; error: string }
> {
  if (!Uuid.safeParse(teamId).success) {
    return { ok: false, error: "That team isn't available — refresh and retry." };
  }
  try {
    const { items } = await listLoadTeamMembers(teamId);
    return { ok: true, members: items };
  } catch (err) {
    return { ok: false, error: _message(err, "load the members") };
  }
}

export async function addMemberAction(
  teamId: string,
  userId: string,
): Promise<ActionResult> {
  if (!Uuid.safeParse(teamId).success || !Uuid.safeParse(userId).success) {
    return { ok: false, error: "Pick someone from the list." };
  }
  try {
    await addLoadTeamMember(teamId, userId);
  } catch (err) {
    // Already on the team: the end state is the one asked for.
    if (!(err instanceof ApiError && err.status === 409)) {
      return { ok: false, error: _message(err, "add the member") };
    }
  }
  _revalidate();
  return { ok: true };
}

export async function removeMemberAction(
  teamId: string,
  memberId: string,
): Promise<ActionResult> {
  if (!Uuid.safeParse(teamId).success || !Uuid.safeParse(memberId).success) {
    return { ok: false, error: "That member isn't available — refresh and retry." };
  }
  try {
    await removeLoadTeamMember(teamId, memberId);
  } catch (err) {
    // Already gone: same end state.
    if (!(err instanceof ApiError && err.status === 404)) {
      return { ok: false, error: _message(err, "remove the member") };
    }
  }
  _revalidate();
  return { ok: true };
}
