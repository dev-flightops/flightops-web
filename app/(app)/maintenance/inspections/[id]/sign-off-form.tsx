"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";
import type { CertType } from "@/lib/api/inspections";

import { cancelInspectionAction, signOffAction } from "../actions";

/**
 * The sign-off (#178): the entry 14 CFR 43.11 asks for, the signer's name,
 * certificate and the aircraft's total time, and the due-list item the
 * inspection satisfies, which is recorded done with it and moves on to its
 * next due. Legacy marked an inspection complete with no signer at all.
 */
export function SignOffForm({
  inspectionId,
  today,
  signer,
  totalHours,
  annual,
  dueItems,
  suggestedDueItemId,
}: {
  inspectionId: string;
  today: string;
  signer: string;
  totalHours: number | null;
  /** An annual needs an inspection authorization (14 CFR 65.95). */
  annual: boolean;
  dueItems: { id: string; label: string }[];
  suggestedDueItemId: string | null;
}) {
  const [form, setForm] = useState({
    signed_off_on: today,
    signer_name: signer,
    cert_number: "",
    cert_type: (annual ? "ia" : "ap") as CertType,
    total_time_hours: totalHours === null ? "" : String(totalHours),
    notes: "",
    due_item_id: suggestedDueItemId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [name]: e.target.value }));

  return (
    <form
      method="post"
      aria-label="Sign off"
      className="rounded-lg border border-border border-l-[3px] border-l-status-green bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await signOffAction(inspectionId, form);
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <h2 className="section-title">Sign Off</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Every item has passed or been corrected. Signing records who signed, their certificate and the aircraft&apos;s
        total time{dueItems.length ? ", and the due-list item it satisfies" : ""}.
      </p>
      {error ? (
        <p role="alert" className="notice notice-red mb-3">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="so-signer" className="field-label">
            Signed By<span className="text-status-red"> *</span>
          </label>
          <input id="so-signer" value={form.signer_name} onChange={set("signer_name")} maxLength={200} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="so-date" className="field-label">
            Date
          </label>
          <input id="so-date" type="date" value={form.signed_off_on} max={today} onChange={set("signed_off_on")} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="so-cert-type" className="field-label">
            Certificate
          </label>
          <select id="so-cert-type" value={form.cert_type} onChange={set("cert_type")} className="ff-input px-3 py-2 text-sm">
            <option value="ap">A&amp;P</option>
            <option value="ia">IA</option>
            <option value="repairman">Repairman</option>
          </select>
          {annual && form.cert_type !== "ia" ? (
            <p className="mt-1 text-xs text-status-yellow">An annual inspection is signed by an IA.</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="so-cert" className="field-label">
            Certificate Number<span className="text-status-red"> *</span>
          </label>
          <input id="so-cert" value={form.cert_number} onChange={set("cert_number")} maxLength={64} className="ff-input px-3 py-2 font-mono text-sm" />
        </div>
        <div>
          <label htmlFor="so-hours" className="field-label">
            Aircraft Total Time (h)
          </label>
          <input
            id="so-hours"
            inputMode="decimal"
            value={form.total_time_hours}
            onChange={set("total_time_hours")}
            className="ff-input px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label htmlFor="so-due" className="field-label">
            Due-List Item It Satisfies
          </label>
          <select id="so-due" value={form.due_item_id} onChange={set("due_item_id")} className="ff-input px-3 py-2 text-sm">
            <option value="">None</option>
            {dueItems.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="so-notes" className="field-label">
          Notes
        </label>
        <textarea id="so-notes" rows={2} value={form.notes} onChange={set("notes")} className="ff-input px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" disabled={pending} className={buttonSolid}>
          Sign Off Inspection
        </button>
        {pending ? <Spinner size="xs" /> : null}
      </div>
    </form>
  );
}

/** Call off an inspection entered by mistake. Squawks its items opened stay open. */
export function CancelInspection({ inspectionId }: { inspectionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        className={`${buttonOutline} text-status-red`}
        onClick={() => {
          if (!window.confirm("Cancel this inspection? Squawks its items opened stay open.")) return;
          setError(null);
          startTransition(async () => {
            const result = await cancelInspectionAction(inspectionId);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        Cancel Inspection
      </button>
      {error ? (
        <span role="alert" className="field-error">
          {error}
        </span>
      ) : null}
    </span>
  );
}
