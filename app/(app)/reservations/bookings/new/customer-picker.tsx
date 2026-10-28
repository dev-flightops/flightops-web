"use client";

import { useId, useMemo, useState } from "react";

import type { Customer } from "@/lib/api/reservations";

/**
 * Who the booking is for: an existing customer as you type, or a new one
 * by name (#137).
 *
 * The client, 27 Oct: "no drop down of customers when I started typing",
 * and the manual form's select had "no way to manually type a name". A
 * caller who isn't on file yet is the usual case at a booking desk, so the
 * typed name is offered as a new customer, made when the booking is filed.
 */
export function CustomerPicker({
  customers,
  preselectCustomerId,
  initialName,
  error,
  onNameChange,
}: {
  customers: Customer[];
  preselectCustomerId: string | null;
  initialName?: string | null;
  error?: string;
  onNameChange?: (name: string) => void;
}) {
  const id = useId();
  const preselected = customers.find((c) => c.id === preselectCustomerId) ?? null;
  const [query, setQuery] = useState(preselected?.full_name ?? initialName ?? "");
  const [selected, setSelected] = useState<Customer | null>(preselected);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return customers
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(needle) ||
          (c.company_name ?? "").toLowerCase().includes(needle) ||
          (c.phone ?? "").includes(needle),
      )
      .slice(0, 8);
  }, [query, customers]);
  const exact = matches.some((c) => c.full_name.trim().toLowerCase() === query.trim().toLowerCase());
  const typed = query.trim();

  function choose(c: Customer | null) {
    setSelected(c);
    setOpen(false);
    if (c) {
      setQuery(c.full_name);
      onNameChange?.(c.full_name);
    }
  }

  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="field-label">
        Customer
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && (matches.length > 0 || typed.length > 0)}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        value={query}
        placeholder="Type a name, company or phone"
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setOpen(true);
          onNameChange?.(e.target.value);
        }}
        className="ff-input"
      />
      <input type="hidden" name="customer_id" value={selected?.id ?? ""} />
      <input type="hidden" name="new_customer_name" value={selected ? "" : typed} />
      {open && typed && !selected ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto border border-border bg-card text-sm shadow-sm"
        >
          {matches.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(c)}
                className="block w-full px-3 py-2 text-left hover:bg-accent"
              >
                {c.full_name}
                {c.company_name ? <span className="text-muted-foreground"> — {c.company_name}</span> : null}
              </button>
            </li>
          ))}
          {!exact ? (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelected(null);
                  setOpen(false);
                }}
                className="block w-full border-t border-border px-3 py-2 text-left font-semibold hover:bg-accent"
              >
                New customer: {typed}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      {error ? (
        <p className="field-error">{error}</p>
      ) : (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
          {selected
            ? `On file${selected.company_name ? ` — ${selected.company_name}` : ""}.`
            : typed
              ? `${typed} isn't on file: filing the booking adds them as a customer.`
              : "Pick from the list, or type a new customer's name."}
        </p>
      )}
    </div>
  );
}
