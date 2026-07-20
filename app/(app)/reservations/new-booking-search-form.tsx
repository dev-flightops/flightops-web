"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { Customer } from "@/lib/api/reservations";

/**
 * New Booking search form — mirrors legacy peregrineflight.com's
 * shopping-style search. All fields feed into a redirect to
 * /reservations/bookings/new with query params, since we don't have
 * a scheduled-flight inventory to search yet.
 */

type TripType = "one_way" | "return" | "freight_only";

const TRIP_TYPES: Array<{ id: TripType; label: string }> = [
  { id: "one_way", label: "One Way" },
  { id: "return", label: "Return" },
  { id: "freight_only", label: "Freight Only" },
];

function _todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function NewBookingSearchForm({
  customers,
}: {
  customers: Customer[];
}) {
  const router = useRouter();
  const [tripType, setTripType] = useState<TripType>("one_way");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [date, setDate] = useState(_todayIso());
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [via, setVia] = useState("");
  const [warnIfDeparted, setWarnIfDeparted] = useState(true);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [showAllFareClasses, setShowAllFareClasses] = useState(false);

  const filteredCustomers = useMemo(() => {
    if (!customerQuery.trim()) return [];
    const needle = customerQuery.trim().toLowerCase();
    return customers
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(needle) ||
          (c.company_name?.toLowerCase().includes(needle) ?? false) ||
          (c.email?.toLowerCase().includes(needle) ?? false) ||
          (c.phone?.includes(needle) ?? false),
      )
      .slice(0, 8);
  }, [customerQuery, customers]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Total pax = adults + children (legacy carries them separately for
    // fare-class pricing; we collapse to a single pax_count on the
    // create-booking form until fare classes ship).
    const pax = Math.max(1, adults + children);
    // Legacy uses a `date` local YYYY-MM-DD; the create-booking form
    // wants a full datetime-local. Default to 09:00 local on the
    // chosen date — same default my new-booking form already uses.
    const departure = `${date}T09:00`;

    const params = new URLSearchParams();
    if (customerId) params.set("customer", customerId);
    if (origin.trim()) params.set("origin", origin.trim().toUpperCase());
    if (destination.trim())
      params.set("destination", destination.trim().toUpperCase());
    params.set("date", departure);
    params.set("pax", String(pax));
    if (via.trim()) params.set("via", via.trim().toUpperCase());
    if (couponCode.trim()) params.set("coupon", couponCode.trim());
    if (tripType !== "one_way") params.set("trip_type", tripType);

    router.push(`/reservations/bookings/new?${params.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-card p-4"
    >
      {/* Row 1 — Trip type / Adults / Children / Customer / Coupon */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_auto_auto_1fr_10rem]">
        <Field label="Trip Type">
          <div className="flex flex-wrap gap-1">
            {TRIP_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTripType(t.id)}
                aria-pressed={tripType === t.id}
                className={
                  "rounded-md border px-3 py-1.5 text-xs font-semibold transition " +
                  (tripType === t.id
                    ? "border-status-blue bg-status-blue/15 text-status-blue"
                    : "border-border bg-background text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Adults">
          <select
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="ff w-16"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Children">
          <select
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
            className="ff w-16"
          >
            {Array.from({ length: 10 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Customer">
          <div className="relative">
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setCustomerId(null);
              }}
              placeholder="Search name, phone, or account…"
              className="ff"
              autoComplete="off"
            />
            {customerQuery.trim() && !customerId && filteredCustomers.length > 0 ? (
              <ul className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {filteredCustomers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerQuery(
                          c.company_name
                            ? `${c.full_name} — ${c.company_name}`
                            : c.full_name,
                        );
                      }}
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted/20"
                    >
                      <span className="font-semibold">{c.full_name}</span>
                      {c.company_name ? (
                        <span className="ml-2 text-muted-foreground">
                          {c.company_name}
                        </span>
                      ) : null}
                      {c.email ? (
                        <span className="ml-2 text-muted-foreground">
                          {c.email}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Field>
        <Field label="Coupon Code">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Promo code"
            className="ff"
            autoComplete="off"
          />
        </Field>
      </div>

      {/* Row 2 — Date / From / To / Via */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[10rem_1fr_1fr_10rem]">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="ff"
          />
        </Field>
        <Field label="From">
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Origin ICAO"
            maxLength={10}
            className="ff uppercase"
            autoComplete="off"
          />
        </Field>
        <Field label="To">
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Destination ICAO"
            maxLength={10}
            className="ff uppercase"
            autoComplete="off"
          />
        </Field>
        <Field label="Via (optional)">
          <input
            type="text"
            value={via}
            onChange={(e) => setVia(e.target.value)}
            placeholder="Stop"
            maxLength={10}
            className="ff uppercase"
            autoComplete="off"
          />
        </Field>
      </div>

      {/* Row 3 — Checkboxes */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-foreground/80">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={warnIfDeparted}
            onChange={(e) => setWarnIfDeparted(e.target.checked)}
          />
          Warn if departed
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={hideUnavailable}
            onChange={(e) => setHideUnavailable(e.target.checked)}
          />
          Hide unavailable
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showAllFareClasses}
            onChange={(e) => setShowAllFareClasses(e.target.checked)}
          />
          Show all fare classes
        </label>
      </div>

      {/* Row 4 — Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          disabled
          title="Gift vouchers ship with the fares vertical (M3 follow-up)"
          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground/70 cursor-not-allowed"
        >
          Use Gift Voucher
        </button>
        <button
          type="submit"
          className="rounded-md bg-status-blue px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Search Flights
        </button>
      </div>

      <style>{`
        .ff {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ff:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
