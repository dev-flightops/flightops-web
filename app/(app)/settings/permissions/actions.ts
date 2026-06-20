"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { setAdminAccess } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * Server action for the Admin Access toggle (M2-X-1 follow-up).
 *
 * Wraps `setAdminAccess` so the client toggle component doesn't try to
 * call the server-only `apiFetch` (which reads the Auth.js session
 * cookie). The first attempt at this PR shipped the client component
 * calling `setAdminAccess` directly — that fails with "no session"
 * inside the browser, which the toggle surfaced as "Couldn't save —
 * try again". This action moves the API call back to the server.
 *
 * Returns `{ok, error}` so the toggle can roll back its optimistic UI
 * and show a context-specific message on failure.
 *
 * Revalidates `/settings/permissions` on success so a fresh SSR render
 * picks up the new flag (the live grid stays in sync with the
 * optimistic UI on the same tab; other tabs catch up on next nav).
 */

const ROLE_IDS = [
  "exec_admin",
  "dispatcher",
  "chief_pilot",
  "maintenance",
  "ground_ops",
  "pilot",
  "crew_member",
] as const;

const ToggleSchema = z.object({
  role: z.enum(ROLE_IDS),
  admin_access: z.boolean(),
  reason: z.string().max(500).optional(),
});

export interface ToggleResult {
  ok: boolean;
  error?: "forbidden" | "unknown_role" | "network";
}

export async function toggleAdminAccessAction(
  input: z.input<typeof ToggleSchema>,
): Promise<ToggleResult> {
  const parsed = ToggleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "unknown_role" };
  }

  try {
    await setAdminAccess(parsed.data.role, {
      admin_access: parsed.data.admin_access,
      reason: parsed.data.reason,
    });
    revalidatePath("/settings/permissions");
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) return { ok: false, error: "forbidden" };
      if (err.status === 400) return { ok: false, error: "unknown_role" };
    }
    return { ok: false, error: "network" };
  }
}
