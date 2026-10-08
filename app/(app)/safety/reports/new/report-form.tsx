"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  LIKELIHOOD_LABELS,
  RISK_SCALE,
  SAFETY_REPORT_TYPES,
  SAFETY_REPORT_TYPE_LABELS,
  SEVERITY_LABELS,
  type SafetyReportType,
} from "@/lib/api/safety-reports";
import { todayIsoDay } from "@/lib/iso-day";
import { formOversizeMessage, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

import { fileSafetyReportAction, type FileReportState } from "./actions";

const _initial: FileReportState = { status: "idle", attempt: 0 };

/**
 * Legacy's "File Safety Report" form, field for field: anonymous toggle,
 * name and department, type and date, title, description, where, flight
 * and tail, severity and likelihood, one photo or PDF.
 *
 * One deviation: legacy's "Your Name" was free text, so a report could
 * be filed under anyone's name. Here it is the signed-in person, shown
 * so they can see who they are filing as.
 */
export function SafetyReportForm({
  reporterName,
  today,
  returnTo,
  cancelHref,
  startType,
}: {
  /** The type to start on: the ASAP hub opens the form on ASAP. */
  startType?: SafetyReportType;
  reporterName: string;
  /** YYYY-MM-DD on the server, for the first render. The browser's own
   *  day replaces it on mount: an Alaska evening is already tomorrow in
   *  UTC, where the server runs. */
  today: string;
  returnTo: string | null;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(fileSafetyReportAction, _initial);
  // Remounted after a failed filing, so every field starts from what
  // was sent rather than from what React's reset left behind.
  return (
    <FilingForm
      key={state.attempt}
      state={state}
      formAction={formAction}
      pending={pending}
      reporterName={reporterName}
      today={today}
      returnTo={returnTo}
      cancelHref={cancelHref}
      startType={startType}
    />
  );
}

function FilingForm({
  state,
  formAction,
  pending,
  reporterName,
  today,
  returnTo,
  cancelHref,
  startType,
}: {
  startType?: SafetyReportType;
  state: FileReportState;
  formAction: (form: FormData) => void;
  pending: boolean;
  reporterName: string;
  today: string;
  returnTo: string | null;
  cancelHref: string;
}) {
  const v = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const [reportType, setReportType] = useState(v.report_type || startType || "safety_concern");
  // ASAP is confidential, not anonymous (#59): the Event Review Committee
  // has to be able to reach the reporter, and the API refuses otherwise.
  const asap = reportType === "asap";
  const [anonymousChecked, setAnonymous] = useState(v.is_anonymous === "on");
  const anonymous = anonymousChecked && !asap;
  const [sizeError, setSizeError] = useState<string | null>(null);
  const message = sizeError ?? (state.status === "error" ? state.message : null);
  const dateRef = useRef<HTMLInputElement>(null);
  const echoedDate = v.occurred_on;

  useEffect(() => {
    const input = dateRef.current;
    if (!input) return;
    const local = todayIsoDay();
    input.max = local;
    if (!echoedDate) input.value = local;
  }, [echoedDate]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const tooBig = formOversizeMessage(e.currentTarget);
        setSizeError(tooBig);
        if (tooBig) e.preventDefault();
      }}
      className="space-y-4 rounded-lg border border-border bg-card p-5"
    >
      {returnTo ? <input type="hidden" name="return_url" value={returnTo} /> : null}

      {message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {message}
        </div>
      ) : null}

      {asap ? (
        <p className="rounded-md border border-border bg-muted/60 px-3 py-2 text-[0.6875rem] text-muted-foreground">
          An ASAP report carries your name: the Event Review Committee has to be able to reach you, and
          the ASAP agreement only protects reports it can. It stays confidential to the Safety Officer,
          the Director of Operations and Exec Admins.
        </p>
      ) : (
        <div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="is_anonymous"
              checked={anonymousChecked}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-sm font-semibold text-foreground">Submit anonymously</span>
          </label>
          <p className="mt-1 text-[0.6875rem] text-muted-foreground">
            {anonymous
              ? "Your name is hidden from everyone reviewing it except the Safety Officer and Exec Admins. You can still follow the report under My Reports."
              : "The safety team will see your name, so they can ask you about it."}
          </p>
        </div>
      )}

      {anonymous ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your Name" name="reporter_name">
            <input id="reporter_name" type="text" value={reporterName} readOnly className="ff-input" />
          </Field>
          <Field label="Department" name="reporter_department" error={errors.reporter_department}>
            <input
              id="reporter_department"
              name="reporter_department"
              type="text"
              maxLength={100}
              defaultValue={v.reporter_department ?? ""}
              placeholder="Flight Ops, Maintenance, etc."
              className="ff-input"
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Report Type" name="report_type" error={errors.report_type}>
          <select
            id="report_type"
            name="report_type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as SafetyReportType)}
            className="ff-input"
          >
            {SAFETY_REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {SAFETY_REPORT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" name="occurred_on" error={errors.occurred_on}>
          <input
            id="occurred_on"
            name="occurred_on"
            type="date"
            ref={dateRef}
            max={today}
            defaultValue={v.occurred_on ?? today}
            className="ff-input"
          />
        </Field>
      </div>

      <Field label="Title *" name="title" error={errors.title}>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={300}
          defaultValue={v.title ?? ""}
          placeholder="Brief summary of the safety concern"
          className="ff-input"
        />
      </Field>

      <Field label="Description *" name="description" error={errors.description}>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          maxLength={10000}
          defaultValue={v.description ?? ""}
          placeholder="What happened? What did you observe? Include details."
          className="ff-input"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Location / Airport" name="location" error={errors.location}>
          <input
            id="location"
            name="location"
            type="text"
            maxLength={200}
            defaultValue={v.location ?? ""}
            placeholder="PADQ, ramp, hangar"
            className="ff-input"
          />
        </Field>
        <Field label="Flight #" name="flight_number" error={errors.flight_number}>
          <input
            id="flight_number"
            name="flight_number"
            type="text"
            maxLength={50}
            defaultValue={v.flight_number ?? ""}
            className="ff-input"
          />
        </Field>
        <Field label="Aircraft Tail" name="aircraft_tail" error={errors.aircraft_tail}>
          <input
            id="aircraft_tail"
            name="aircraft_tail"
            type="text"
            maxLength={20}
            defaultValue={v.aircraft_tail ?? ""}
            className="ff-input uppercase"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Severity" name="severity" error={errors.severity}>
          <select id="severity" name="severity" defaultValue={v.severity ?? ""} className="ff-input">
            <option value="">—</option>
            {RISK_SCALE.map((n) => (
              <option key={n} value={n}>
                {n} — {SEVERITY_LABELS[n]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Likelihood" name="likelihood" error={errors.likelihood}>
          <select id="likelihood" name="likelihood" defaultValue={v.likelihood ?? ""} className="ff-input">
            <option value="">—</option>
            {RISK_SCALE.map((n) => (
              <option key={n} value={n}>
                {n} — {LIKELIHOOD_LABELS[n]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="-mt-2 text-[0.6875rem] text-muted-foreground">
        Optional. Your best guess; the safety team sets the final assessment when they review it.
      </p>

      <AttachmentField onPick={() => setSizeError(null)} />

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit Report"}
        </button>
        <Link
          href={cancelHref}
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-accent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

/** Legacy's dashed drop zone: click or drag one photo or PDF onto it. */
function AttachmentField({ onPick }: { onPick: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Attach Image (optional)
      </span>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const input = e.currentTarget.querySelector("input");
          if (!input || e.dataTransfer.files.length === 0) return;
          input.files = e.dataTransfer.files;
          setFile(e.dataTransfer.files[0]);
          onPick();
        }}
        className={
          "block cursor-pointer rounded-[10px] border-2 border-dashed px-4 py-5 text-center transition-colors focus-within:ring-2 focus-within:ring-ring " +
          (dragging ? "border-primary" : "border-border")
        }
      >
        <input
          type="file"
          name="attachment"
          accept="image/*,.pdf,application/pdf"
          className="sr-only"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            onPick();
          }}
        />
        {file ? (
          <>
            {preview ? (
              <img src={preview} alt="" className="mx-auto mb-2 max-h-40 rounded-lg" />
            ) : null}
            <p className="text-[0.6875rem] text-muted-foreground">{file.name}</p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Click or drag a photo / PDF to attach</p>
            <p className="text-[0.65rem] text-muted-foreground">
              JPG, PNG, GIF, WEBP, PDF accepted · up to {MAX_UPLOAD_LABEL}
            </p>
          </>
        )}
      </label>
    </div>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={name}
        className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-[0.6875rem] text-status-red">{error}</p> : null}
    </div>
  );
}
