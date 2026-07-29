"use client";

import { useState } from "react";

import type { Customer } from "@/lib/api/reservations";

import { EnrollMemberForm } from "./enroll-form";

/**
 * Header "+ Enroll Member" button + collapsible enroll form.
 * Server-renders inline; toggle shows/hides.
 */
export function EnrollMemberToggle({
  customers,
  buttonLabel,
}: {
  customers: Customer[];
  buttonLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          {buttonLabel}
        </button>
      )}
      {open && (
        <div className="mb-5 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {buttonLabel.replace(/^\+\s*/, "")}
            </h2>
          </div>
          <EnrollMemberForm
            customers={customers}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
