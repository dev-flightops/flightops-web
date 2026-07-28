"use client";

import { useState } from "react";

import type { Customer } from "@/lib/api/reservations";

import { NewCharterForm } from "./new-charter-form";

/**
 * Header "+ New Charter Request" button + collapsible form. Server
 * renders the form in-page but hidden; toggle exposes it. Matches
 * legacy peregrineflight pattern of an inline expand form rather
 * than a separate route.
 */
export function NewCharterToggle({ customers }: { customers: Customer[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          + New Charter Request
        </button>
      )}
      {open && (
        <div className="mb-5 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              New Charter Request
            </h2>
          </div>
          <NewCharterForm
            customers={customers}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}
