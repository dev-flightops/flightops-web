import { redirect } from "next/navigation";

import { getSupplierSession } from "@/lib/api/supplier-session";

import { SupplierLoginForm } from "./login-form";

/**
 * M3-X-2 — Fuel Supplier Portal login.
 *
 * External supplier employees (AvFuel Sarah, Crowley Bob, etc.)
 * sign in here with credentials stored in the tenant-INDEPENDENT
 * fuel_supplier_accounts table. On success we set an httpOnly
 * fuel_supplier_session cookie and redirect to /fuel-supplier
 * (the unified inbox).
 *
 * If the caller already has an active session, skip the form and
 * jump straight to the inbox — avoids the login flicker for a
 * refresh-happy user.
 */
export default async function SupplierLoginPage() {
  const session = await getSupplierSession();
  if (session) redirect("/fuel-supplier");

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-bold tracking-tight">
          Fuel Supplier Portal
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Sign in to see and act on the fuel orders addressed to your
          company across every operator you serve.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-5">
        <SupplierLoginForm />
      </div>

      <p className="mt-5 text-center text-[0.7rem] text-muted-foreground">
        Not a fuel supplier?{" "}
        <a
          href="/login"
          className="font-semibold text-status-blue hover:underline"
        >
          Sign in to the operator portal →
        </a>
      </p>
    </div>
  );
}
