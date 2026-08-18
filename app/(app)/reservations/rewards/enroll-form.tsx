"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Customer } from "@/lib/api/reservations";

import { enrollMemberAction, type RewardsActionState } from "./actions";

const INITIAL: RewardsActionState = { status: "idle" };

/** Enroll a customer in the rewards program. Customer autocomplete
 *  filters over the tenant list; enrolled_station is optional
 *  free-text (ICAO of the base where they signed up). */
export function EnrollMemberForm({
  customers,
  onClose,
}: {
  customers: Customer[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    enrollMemberAction,
    INITIAL,
  );
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState<string>("");

  const filtered = useMemo(() => {
    if (!customerQuery.trim()) return [];
    const q = customerQuery.trim().toLowerCase();
    return customers
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.company_name?.toLowerCase().includes(q) ?? false) ||
          (c.email?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 8);
  }, [customerQuery, customers]);

  useEffect(() => {
    if (state.status === "ok") {
      const t = setTimeout(() => {
        onClose();
        router.refresh();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [state.status, onClose, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="customer_id" value={customerId ?? ""} />

      <div>
        <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Customer
        </label>
        {customerId ? (
          <div className="flex items-center gap-2 rounded-md border border-status-blue bg-status-blue/10 px-3 py-2 text-sm">
            <span className="font-semibold">{customerLabel}</span>
            <button
              type="button"
              onClick={() => {
                setCustomerId(null);
                setCustomerLabel("");
                setCustomerQuery("");
              }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Search by name, company, or email"
              autoComplete="off"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {filtered.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-card shadow-lg">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerLabel(
                          c.company_name
                            ? `${c.full_name} — ${c.company_name}`
                            : c.full_name,
                        );
                        setCustomerQuery("");
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/30"
                    >
                      <div className="font-semibold">{c.full_name}</div>
                      {c.company_name && (
                        <div className="text-xs text-muted-foreground">
                          {c.company_name}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Enrolled station (optional)
          </span>
          <input
            type="text"
            name="enrolled_station"
            maxLength={10}
            placeholder="e.g. PANC"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Notes
        </span>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}
      {state.status === "ok" && state.message ? (
        <div
          role="status"
          className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          {state.message}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !customerId}
          className="rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Enrolling…" : "Enroll Member"}
        </button>
      </div>
    </form>
  );
}
