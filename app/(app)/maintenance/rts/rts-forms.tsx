"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";
import type { CertType } from "@/lib/api/maintenance";

import { deferAction, inspectAction, rejectAction, signOffAction, type RtsResult } from "./actions";

function useSubmit(onDone?: () => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return {
    error,
    pending,
    submit(run: () => Promise<RtsResult>) {
      setError(null);
      startTransition(async () => {
        const result = await run();
        if (result.ok) {
          onDone?.();
          router.refresh();
        } else {
          setError(result.message);
        }
      });
    },
  };
}

function Refusal({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-sm text-status-red">
      {text}
    </p>
  ) : null;
}

/**
 * The AMT's sign-off (#172): legacy's "Sign Off Airworthy". A Required Inspection
 * Item stays held until someone else inspects it, and one already flagged RII can't
 * be unflagged here.
 */
export function SignOffForm({
  squawkId,
  aircraftId,
  name,
  rii = false,
  idPrefix = "signoff",
  onDone,
}: {
  squawkId: string;
  aircraftId: string;
  /** The viewer's name, to start from. */
  name: string;
  /** Already flagged RII. */
  rii?: boolean;
  idPrefix?: string;
  onDone?: () => void;
}) {
  const [workNotes, setWorkNotes] = useState("");
  const [amtName, setAmtName] = useState(name);
  const [certNumber, setCertNumber] = useState("");
  const [certType, setCertType] = useState<CertType | "">("");
  const [isRii, setIsRii] = useState(rii);
  const [airworthy, setAirworthy] = useState(false);
  const { error, pending, submit } = useSubmit(onDone);
  const id = (field: string) => `${idPrefix}-${squawkId}-${field}`;

  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          signOffAction(squawkId, aircraftId, {
            work_notes: workNotes,
            amt_name: amtName,
            cert_number: certNumber,
            cert_type: certType as CertType,
            airworthy: airworthy as true,
            is_rii: isRii,
          }),
        );
      }}
    >
      <div>
        <label htmlFor={id("work")} className="field-label">
          Work Performed<span className="text-status-red"> *</span>
        </label>
        <textarea
          id={id("work")}
          rows={3}
          required
          maxLength={4000}
          value={workNotes}
          onChange={(e) => setWorkNotes(e.target.value)}
          placeholder="Describe work performed, parts replaced, inspections completed, reference numbers"
          className="ff-input px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={id("name")} className="field-label">
            AMT Name<span className="text-status-red"> *</span>
          </label>
          <input id={id("name")} required maxLength={200} value={amtName} onChange={(e) => setAmtName(e.target.value)} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor={id("cert")} className="field-label">
            FAA Certificate #<span className="text-status-red"> *</span>
          </label>
          <input
            id={id("cert")}
            required
            maxLength={64}
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            placeholder="e.g. 1234567"
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={id("type")} className="field-label">
            Certificate Type<span className="text-status-red"> *</span>
          </label>
          <select id={id("type")} required value={certType} onChange={(e) => setCertType(e.target.value as CertType)} className="ff-input px-3 py-2 text-sm">
            <option value="">Select…</option>
            <option value="ap">A&amp;P</option>
            <option value="ia">IA</option>
            <option value="repairman">Repairman</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isRii} disabled={rii} onChange={(e) => setIsRii(e.target.checked)} />
        RII: Required Inspection Item, needs a second person to inspect
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" required checked={airworthy} onChange={(e) => setAirworthy(e.target.checked)} />
        I certify this aircraft is airworthy{isRii ? "" : " and returned to service"}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonSolid}>
          {isRii ? "Sign and Send to Inspector" : "Sign Off Airworthy"}
        </button>
        {pending ? <Spinner size="xs" /> : null}
        <Refusal text={error} />
      </div>
    </form>
  );
}

/** The inspector's sign-off: a second person, 14 CFR 135.429(c). */
export function InspectForm({ squawkId, aircraftId, name }: { squawkId: string; aircraftId: string; name: string }) {
  const [inspector, setInspector] = useState(name);
  const [certNumber, setCertNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { error, pending, submit } = useSubmit();
  const id = (field: string) => `rii-${squawkId}-${field}`;

  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          inspectAction(squawkId, aircraftId, {
            inspector_name: inspector,
            cert_number: certNumber,
            notes,
            confirmed: confirmed as true,
          }),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={id("name")} className="field-label">
            Inspector Name<span className="text-status-red"> *</span>
          </label>
          <input id={id("name")} required maxLength={200} value={inspector} onChange={(e) => setInspector(e.target.value)} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor={id("cert")} className="field-label">
            FAA Certificate Number<span className="text-status-red"> *</span>
          </label>
          <input
            id={id("cert")}
            required
            maxLength={64}
            value={certNumber}
            onChange={(e) => setCertNumber(e.target.value)}
            placeholder="e.g. 1234567"
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={id("notes")} className="field-label">
            Inspection Notes
          </label>
          <input id={id("notes")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Findings (optional)" className="ff-input px-3 py-2 text-sm" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I confirm the RII inspection is complete and satisfactory
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonSolid}>
          Complete RII Signoff
        </button>
        {pending ? <Spinner size="xs" /> : null}
        <Refusal text={error} />
      </div>
    </form>
  );
}

export function RejectForm({ squawkId, aircraftId }: { squawkId: string; aircraftId: string }) {
  const [reason, setReason] = useState("");
  const { error, pending, submit } = useSubmit();
  const id = `reject-${squawkId}`;
  return (
    <form
      method="post"
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => rejectAction(squawkId, aircraftId, reason));
      }}
    >
      <label htmlFor={id} className="field-label">
        Reason for rejection<span className="text-status-red"> *</span>
      </label>
      <textarea id={id} rows={2} required value={reason} onChange={(e) => setReason(e.target.value)} className="ff-input px-3 py-2 text-sm" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonOutline}>
          Reject &amp; Return to Open
        </button>
        {pending ? <Spinner size="xs" /> : null}
        <Refusal text={error} />
      </div>
    </form>
  );
}

/**
 * MEL or DMI instead of a fix. The categories are the MMEL's: A as its remarks
 * say, B 3 days, C 10, D 120. A date past the limit is refused by the server.
 */
export function DeferForm({ squawkId, aircraftId }: { squawkId: string; aircraftId: string }) {
  const [type, setType] = useState<"mel" | "dmi">("mel");
  const [category, setCategory] = useState<"A" | "B" | "C" | "D">("C");
  const [ata, setAta] = useState("");
  const [reference, setReference] = useState("");
  const [due, setDue] = useState("");
  const [reason, setReason] = useState("");
  const { error, pending, submit } = useSubmit();
  const id = (field: string) => `defer-${squawkId}-${field}`;

  return (
    <form
      method="post"
      className="mt-2 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          deferAction(squawkId, aircraftId, {
            defer_type: type,
            reason,
            mel_category: category,
            ata_chapter: ata,
            reference,
            due_on: due,
          }),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={id("type")} className="field-label">
            Deferral Type
          </label>
          <select id={id("type")} value={type} onChange={(e) => setType(e.target.value as "mel" | "dmi")} className="ff-input px-3 py-2 text-sm">
            <option value="mel">MEL</option>
            <option value="dmi">DMI</option>
          </select>
        </div>
        {type === "mel" ? (
          <>
            <div>
              <label htmlFor={id("category")} className="field-label">
                MEL Category
              </label>
              <select
                id={id("category")}
                value={category}
                onChange={(e) => setCategory(e.target.value as "A" | "B" | "C" | "D")}
                className="ff-input px-3 py-2 text-sm"
              >
                <option value="A">Cat A (per the remarks)</option>
                <option value="B">Cat B (3 days)</option>
                <option value="C">Cat C (10 days)</option>
                <option value="D">Cat D (120 days)</option>
              </select>
            </div>
            <div>
              <label htmlFor={id("ata")} className="field-label">
                ATA Chapter<span className="text-status-red"> *</span>
              </label>
              <input id={id("ata")} required maxLength={10} value={ata} onChange={(e) => setAta(e.target.value)} placeholder="e.g. 24-30" className="ff-input px-3 py-2 text-sm" />
            </div>
          </>
        ) : null}
        <div>
          <label htmlFor={id("reference")} className="field-label">
            {type === "mel" ? "MEL Reference" : "Reference"}
          </label>
          <input id={id("reference")} maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor={id("due")} className="field-label">
            Due Date
            {type === "dmi" || category === "A" ? <span className="text-status-red"> *</span> : null}
          </label>
          <input
            id={id("due")}
            type="date"
            required={type === "dmi" || category === "A"}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor={id("reason")} className="field-label">
          Deferral Reason<span className="text-status-red"> *</span>
        </label>
        <input id={id("reason")} required value={reason} onChange={(e) => setReason(e.target.value)} className="ff-input px-3 py-2 text-sm" />
      </div>
      <p className="text-xs text-muted-foreground">
        {type === "mel"
          ? "Opens an MEL item, which holds the aircraft when it comes due, and clears the squawk."
          : "Puts it on the aircraft's due list, where it grounds the aircraft if the date passes, and clears the squawk."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonOutline}>
          Defer
        </button>
        {pending ? <Spinner size="xs" /> : null}
        <Refusal text={error} />
      </div>
    </form>
  );
}
