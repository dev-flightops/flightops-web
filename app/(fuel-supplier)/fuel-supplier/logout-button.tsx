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
      className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent disabled:opacity-60 text-[0.68rem]"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
