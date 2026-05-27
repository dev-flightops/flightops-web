"use server";

import { revalidatePath } from "next/cache";

import { switchTenant as switchTenantApi } from "@/lib/api/auth";

/**
 * Server action that re-issues the session JWT scoped to `tenantId`.
 *
 * Scaffold note (M1-G-6): today the backend only allows switching to the
 * user's current tenant (single-tenant schema), so this is effectively a
 * no-op refresh. The full flow — backend call + Auth.js session update —
 * is wired through so that when multi-tenant memberships land in M2/M3,
 * we only need to teach Auth.js to swap the token in the JWT cookie.
 *
 * The 403 the backend throws on a foreign tenant surfaces as an ApiError
 * here, which the caller can show in the UI.
 */
export async function switchTenantAction(tenantId: string): Promise<void> {
  await switchTenantApi(tenantId);
  // Re-render every route that reads tenant-scoped data
  revalidatePath("/", "layout");
}
