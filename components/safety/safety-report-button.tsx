"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { fileSafetyReportAction } from "./actions";
import type {
  FileSafetyReportResult,
  Likelihood,
  ReportType,
  Severity,
} from "./types";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "safety_concern", label: "Safety Concern" },
  { value: "hazard", label: "Hazard Report" },
  { value: "near_miss", label: "Near Miss" },
  { value: "asap", label: "ASAP Report" },
  { value: "incident", label: "Incident" },
];

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "low", label: "Low — informational" },
  { value: "medium", label: "Medium — hazard worth tracking" },
  { value: "high", label: "High — operational risk" },
  { value: "critical", label: "Critical — immediate attention" },
];

const LIKELIHOODS: { value: Likelihood; label: string }[] = [
  { value: "rare", label: "Rare — unlikely to ever recur" },
  { value: "unlikely", label: "Unlikely — could occur but improbable" },
  { value: "possible", label: "Possible — could occur occasionally" },
  { value: "likely", label: "Likely — will probably recur" },
  { value: "almost_certain", label: "Almost Certain — recurring pattern" },
];

function todayIsoDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Floating red Safety Report button — fixed bottom-right of every
 * authenticated page per the formal Home Page spec, Component 6:
 *
 *   "The red Safety Report button is fixed to the bottom-right corner
 *    of every page in the app — including the home page. It is always
 *    visible regardless of scroll position. All roles see it at all
 *    times."
 *
 * Field set follows legacy peregrineflight.com /safety/reports/new:
 * title, description, report type, severity, likelihood, location,
 * flight #, aircraft tail, occurrence date, anonymous. File
 * attachments + the full SMS module (Policy / SRM / Assurance /
 * Promotion / ASAP / Part 5 / Reports / Incidents) land with
 * safety-service in M3.
 */
export function SafetyReportButton() {
  const [open, setOpen] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [title, setTitle] = useState("");
  const [reportType, setReportType] = useState<ReportType>("safety_concern");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [likelihood, setLikelihood] = useState<Likelihood | "">("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [aircraftTail, setAircraftTail] = useState("");
  const today = useMemo(todayIsoDate, []);
  const [occurredOn, setOccurredOn] = useState<string>(today);
  const [result, setResult] = useState<FileSafetyReportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setAnonymous(false);
    setTitle("");
    setReportType("safety_concern");
    setSeverity("medium");
    setLikelihood("");
    setDescription("");
    setLocation("");
    setFlightNumber("");
    setAircraftTail("");
    setOccurredOn(today);
    setResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await fileSafetyReportAction({
        title,
        description,
        report_type: reportType,
        severity,
        likelihood: likelihood === "" ? null : likelihood,
        location: location || null,
        flight_number: flightNumber || null,
        aircraft_tail: aircraftTail || null,
        occurred_on: occurredOn || null,
        anonymous,
      });
      setResult(res);
    });
  };

  const titleTrim = title.trim();
  const descriptionTrim = description.trim();
  const titleOk = titleTrim.length >= 4;
  const descriptionOk = descriptionTrim.length >= 10;
  const canSubmit = titleOk && descriptionOk && !isPending;

  // Single "what's missing" line shown when the user has started
  // typing but hasn't hit the minima yet. Without this, the disabled
  // Submit button looks silently broken — there's no indication of
  // why it won't fire.
  const missing: string[] = [];
  if (!titleOk) {
    missing.push(
      titleTrim.length === 0
        ? "title"
        : `title (need ${4 - titleTrim.length} more)`,
    );
  }
  if (!descriptionOk) {
    missing.push(
      descriptionTrim.length === 0
        ? "description"
        : `description (need ${10 - descriptionTrim.length} more)`,
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        aria-label="File a safety report"
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-br from-red-600 to-red-700 px-[17.6px] py-[10.4px] text-[12.8px] font-bold text-white shadow-[0_4px_20px_0_rgba(220,38,38,0.45)] ring-1 ring-red-600/30 transition-transform hover:-translate-y-0.5 hover:from-red-500 hover:to-red-600"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
          className="flex-shrink-0"
        >
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z" />
        </svg>
        Safety
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!isPending) setOpen(o);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>File a safety report</DialogTitle>
            <DialogDescription>
              Confidential by default. Anonymous reports strip your user id
              before the record is saved.
            </DialogDescription>
          </DialogHeader>

          {result?.status === "ok" ? (
            <SuccessPanel
              reportId={result.report_id}
              onClose={() => setOpen(false)}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {result?.status === "error" && (
                <div
                  role="alert"
                  className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
                >
                  {result.message}
                </div>
              )}

              <Field
                id="safety-title"
                label="Title (min 4 characters)"
                required
                value={title}
                onChange={setTitle}
                placeholder="Short summary of the safety concern"
                maxLength={200}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="safety-report-type"
                  label="Report type"
                  value={reportType}
                  onChange={(v) => setReportType(v as ReportType)}
                  options={REPORT_TYPES}
                />
                <Field
                  id="safety-occurred-on"
                  label="Date occurred"
                  type="date"
                  value={occurredOn}
                  onChange={setOccurredOn}
                />
              </div>

              <div>
                <label
                  htmlFor="safety-description"
                  className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  What happened? (min 10 characters){" "}
                  <span className="text-status-red">*</span>
                </label>
                <textarea
                  id="safety-description"
                  required
                  minLength={10}
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the hazard, near-miss, or concern. Be specific about who, what, where, when."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-red focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  id="safety-location"
                  label="Location / Airport"
                  value={location}
                  onChange={setLocation}
                  placeholder="PANC, ramp, hangar"
                />
                <Field
                  id="safety-flight-number"
                  label="Flight #"
                  value={flightNumber}
                  onChange={setFlightNumber}
                  placeholder="e.g. PER123"
                />
                <Field
                  id="safety-aircraft-tail"
                  label="Aircraft tail"
                  value={aircraftTail}
                  onChange={(v) => setAircraftTail(v.toUpperCase())}
                  placeholder="N207GE"
                  autoCapitalize="characters"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  id="safety-severity"
                  label="Severity"
                  value={severity}
                  onChange={(v) => setSeverity(v as Severity)}
                  options={SEVERITIES}
                />
                <Select
                  id="safety-likelihood"
                  label="Likelihood (optional)"
                  value={likelihood}
                  onChange={(v) => setLikelihood(v as Likelihood | "")}
                  options={[
                    { value: "", label: "— Pick if known —" },
                    ...LIKELIHOODS,
                  ]}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-status-red"
                />
                <span>
                  Submit anonymously — only my role is stored, not my name
                </span>
              </label>

              <p className="text-[0.65rem] text-muted-foreground/70">
                Safety-service lands in M3 — your filing is recorded to a
                local audit log in dev. File attachments + the full SMS
                module (Policy / SRM / Assurance / ASAP / Part 5 / Incidents)
                follow when safety-service ships.
              </p>

              {missing.length > 0 && (
                <p
                  role="status"
                  className="text-[0.7rem] text-status-yellow"
                >
                  Need {missing.join(" + ")} before submitting.
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-status-red text-white hover:bg-status-red/90"
                >
                  {isPending ? "Submitting…" : "Submit report"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  maxLength,
  autoCapitalize,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  autoCapitalize?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-red focus:outline-none"
      />
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-red focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SuccessPanel({
  reportId,
  onClose,
}: {
  reportId: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="rounded-md border border-status-green/40 bg-status-green/[0.08] px-4 py-3 text-sm text-status-green"
      >
        <p className="font-semibold">✓ Report acknowledged.</p>
        <p className="mt-1 text-xs text-status-green/80">
          Recorded as <code className="font-mono">{reportId.slice(0, 8)}</code>.
          Real submission persists to <code>safety_reports</code> when the
          safety-service ships (M3). Until then the report has been
          appended to the local audit log.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </div>
  );
}
