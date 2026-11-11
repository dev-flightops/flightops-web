"use client";

import { useState, useTransition } from "react";

import { buttonSolid } from "@/components/ff/controls";

import { certifyMisAction } from "../actions";

/** The certifying official's statement that the year's report is accurate
 *  and complete (14 CFR 120.119(b), 120.219(b)): a service agent may prepare
 *  it, a company official certifies it. */
export function CertifyForm({ year, official, phone }: { year: number; official: string; phone: string }) {
  const [values, setValues] = useState({ official_name: official, official_phone: phone, prepared_by: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [name]: e.target.value }));

  return (
    <form
      method="post"
      aria-label={`Certify the ${year} report`}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setMessage(null);
          const result = await certifyMisAction(year, values);
          if (!result.ok) setMessage(result.message);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="certify-name" className="field-label">
            Certifying Official<span className="text-status-red"> *</span>
          </label>
          <input id="certify-name" value={values.official_name} onChange={set("official_name")} maxLength={200} className="ff-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="certify-phone" className="field-label">
            Telephone
          </label>
          <input id="certify-phone" type="tel" value={values.official_phone} onChange={set("official_phone")} maxLength={50} className="ff-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="certify-prepared" className="field-label">
            Prepared By (if different)
          </label>
          <input id="certify-prepared" value={values.prepared_by} onChange={set("prepared_by")} maxLength={200} className="ff-input w-full px-3 py-2 text-sm" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Certifying says the report is accurate and complete. A false statement is an offence under 18 U.S.C. 1001.
      </p>
      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Certifying…" : `Certify ${year}`}
        </button>
      </div>
    </form>
  );
}
