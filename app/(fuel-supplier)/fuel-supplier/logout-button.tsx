"use client";

import { useTransition } from "react";

import { supplierLogoutAction } from "./actions";

/**
 * M3-X-2 — inline sign-out button on the supplier inbox header.
 */
export function SupplierLogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => supplierLogoutAction())}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
