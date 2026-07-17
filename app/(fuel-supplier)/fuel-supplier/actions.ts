"use server";

import { redirect } from "next/navigation";

import { clearSupplierSession } from "@/lib/api/supplier-session";

/**
 * M3-X-2 — logout from the supplier portal. Clears the session
 * cookie + redirects to the login page. Separate action file so the
 * inbox page (a server component) can import without pulling in the
 * login form's action.
 */
export async function supplierLogoutAction(): Promise<void> {
  await clearSupplierSession();
  redirect("/fuel-supplier/login");
}
