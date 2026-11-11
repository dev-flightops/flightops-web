"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { FILE_KINDS } from "@/lib/drug-alcohol/options";

import { returnToDutyAction, uploadTestFileAction } from "../../actions";

/**
 * After an alcohol result of 0.02 to 0.039: the DER puts them back on duty
 * at their next duty period, which FlightOps doesn't know, and never sooner
 * than 8 hours after the test (14 CFR 120.221(f)); the service holds to the
 * 8 hours.
 */
export function ReturnToDutyButton({ userId, testId }: { userId: string; testId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-end gap-1">
      {confirming ? (
        <span className="flex flex-wrap items-center justify-end gap-2 text-xs">
          Their next duty period has started?
          <button
            type="button"
            className={buttonSolid}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setMessage(null);
                const result = await returnToDutyAction(userId, testId);
                if (result.ok) setConfirming(false);
                else setMessage(result.message);
              })
            }
          >
            Back on duty
          </button>
          <button type="button" className={buttonOutline} onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className={linkCaps} onClick={() => setConfirming(true)}>
          Return to duty…
        </button>
      )}
      {message ? (
        <span role="alert" className="field-error">
          {message}
        </span>
      ) : null}
    </span>
  );
}

/** A document kept with the test: the custody and control form, the lab's
 *  results, the MRO's letter. */
export function AttachForm({ userId, testId }: { userId: string; testId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      method="post"
      encType="multipart/form-data"
      aria-label="Attach a document"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          setMessage(null);
          const result = await uploadTestFileAction(userId, testId, form);
          if (result.ok) router.push(`/employees/drug-alcohol/employees/${userId}`);
          else setMessage(result.message);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="attach-kind" className="field-label">
            What It Is
          </label>
          <select id="attach-kind" name="kind" defaultValue="chain_of_custody" className="ff-input w-full px-3 py-2 text-sm">
            {FILE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="attach-file" className="field-label">
            File<span className="text-status-red"> *</span>
          </label>
          <input id="attach-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff,.doc,.docx" className="w-full text-sm" />
          <p className="mt-1 text-xs text-muted-foreground">PDF, image or Word, up to 25 MB.</p>
        </div>
      </div>
      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonOutline} onClick={() => router.push(`/employees/drug-alcohol/employees/${userId}`)} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
}
