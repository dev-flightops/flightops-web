"use client";

import { CERT_TYPE_LABELS, type CertType, type Closure, type SignOff } from "@/lib/api/types";

/**
 * The sign-off that returns an aircraft to service (1119-19). The client's
 * 11/19 audit: "Work orders and MELs close with one click: no corrective
 * action, no mechanic or certificate number, no return-to-service entry
 * (14 CFR 43.9)." Resolving a squawk, closing a work order and clearing an
 * MEL item now each ask for the work done, the mechanic, their certificate
 * and its kind, and their statement, as the RTS queue's sign-off does. A
 * work order or an MEL item can instead close with no work done and why.
 */

export interface SignOffDraft {
  mode: "signed_off" | "no_work";
  workDone: string;
  signerName: string;
  certNumber: string;
  certType: CertType | "";
  airworthy: boolean;
  reason: string;
}

export const EMPTY_SIGN_OFF: SignOffDraft = {
  mode: "signed_off",
  workDone: "",
  signerName: "",
  certNumber: "",
  certType: "",
  airworthy: false,
  reason: "",
};

/** What is still missing, in words, or null when it can be sent. */
export function signOffProblem(draft: SignOffDraft): string | null {
  if (draft.mode === "no_work") {
    return draft.reason.trim() ? null : "Say why no work was done.";
  }
  const missing = [
    !draft.workDone.trim() && "the work done",
    !draft.signerName.trim() && "the mechanic's name",
    !draft.certNumber.trim() && "their certificate number",
    !draft.certType && "the kind of certificate",
  ].filter(Boolean);
  if (missing.length) return `The sign-off needs ${missing.join(", ")}.`;
  if (!draft.airworthy) return "Tick the statement that the work leaves the aircraft airworthy.";
  return null;
}

export function toSignOff(draft: SignOffDraft): SignOff {
  return {
    work_done: draft.workDone.trim(),
    signer_name: draft.signerName.trim(),
    cert_number: draft.certNumber.trim(),
    cert_type: draft.certType as CertType,
    airworthy: true,
  };
}

export function toClosure(draft: SignOffDraft): Closure {
  return draft.mode === "no_work" ? { no_work_reason: draft.reason.trim() } : { sign_off: toSignOff(draft) };
}

const FIELD =
  "mt-1 flex w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export function SignOffFields({
  idPrefix,
  value,
  onChange,
  allowNoWork = false,
  workLabel = "Work done",
  disabled = false,
}: {
  idPrefix: string;
  value: SignOffDraft;
  onChange: (next: SignOffDraft) => void;
  /** A work order or an MEL item may close with no work done. */
  allowNoWork?: boolean;
  workLabel?: string;
  disabled?: boolean;
}) {
  const set = (patch: Partial<SignOffDraft>) => onChange({ ...value, ...patch });
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="field-label">Sign-off (14 CFR 43.9)</legend>
      {allowNoWork ? (
        <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label="How it closes">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={id("mode")}
              checked={value.mode === "signed_off"}
              onChange={() => set({ mode: "signed_off" })}
            />
            Work done: sign it off
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={id("mode")}
              checked={value.mode === "no_work"}
              onChange={() => set({ mode: "no_work" })}
            />
            No work done
          </label>
        </div>
      ) : null}
      {value.mode === "no_work" ? (
        <div>
          <label htmlFor={id("reason")} className="field-label">
            Why no work was done
          </label>
          <textarea
            id={id("reason")}
            rows={2}
            maxLength={2000}
            value={value.reason}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder="Opened in error, a duplicate of another, ..."
            className={FIELD}
          />
        </div>
      ) : (
        <>
          <div>
            <label htmlFor={id("work")} className="field-label">
              {workLabel}
            </label>
            <textarea
              id={id("work")}
              rows={3}
              maxLength={4000}
              value={value.workDone}
              onChange={(e) => set({ workDone: e.target.value })}
              placeholder="What was done, with part numbers and the reference used."
              className={FIELD}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label htmlFor={id("signer")} className="field-label">
                Mechanic
              </label>
              <input
                id={id("signer")}
                maxLength={200}
                value={value.signerName}
                onChange={(e) => set({ signerName: e.target.value })}
                className={FIELD}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={id("cert")} className="field-label">
                Certificate number
              </label>
              <input
                id={id("cert")}
                maxLength={64}
                value={value.certNumber}
                onChange={(e) => set({ certNumber: e.target.value })}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor={id("cert-type")} className="field-label">
                Certificate
              </label>
              <select
                id={id("cert-type")}
                value={value.certType}
                onChange={(e) => set({ certType: e.target.value as CertType | "" })}
                className={FIELD}
              >
                <option value="">Choose…</option>
                {(Object.keys(CERT_TYPE_LABELS) as CertType[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {CERT_TYPE_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.airworthy}
              onChange={(e) => set({ airworthy: e.target.checked })}
              className="mt-1"
            />
            <span>I did this work as described, and it leaves the aircraft airworthy for it.</span>
          </label>
        </>
      )}
    </fieldset>
  );
}
