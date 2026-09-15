"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  DisclosureCategory,
  RequestorAgency,
} from "@/lib/api/reports";

/**
 * Recording a records request and producing its bundle.
 *
 * One form, one action, one record. Filling this in IS the disclosure
 * log entry — there is no "save draft" and no way to produce a bundle
 * without writing the row, because a bundle that leaves the building
 * unrecorded cannot be accounted for later.
 *
 * WHY THIS POSTS TO A ROUTE HANDLER RATHER THAN A SERVER ACTION
 *
 * The response is a zip. Server actions serialise their return value,
 * and `apiFetch` parses bodies — neither carries binary. The handler
 * at /api/compliance/records-request attaches the Bearer token
 * server-side and streams the archive through, which is the same shape
 * the dispatch release PDF uses.
 *
 * WHAT THE FORM REFUSES BEFORE THE SERVICE DOES
 *
 * No categories selected. The service refuses it too, and it must —
 * legacy's PRIA exporter substitutes all eight sections when none are
 * ticked, so an operator intending to disclose two hands over eight.
 * Disabling the button is how that never becomes a round trip.
 */

const AGENCIES: { value: RequestorAgency; label: string }[] = [
  { value: "faa", label: "FAA" },
  { value: "ntsb", label: "NTSB" },
  { value: "other", label: "Other authority" },
];

/** Matches the service. */
const MIN_REASON = 10;

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Pull the filename out of Content-Disposition, falling back rather
 *  than saving something the browser names for us. */
function filenameFrom(header: string | null): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? "records.zip";
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
    >
      {children}
    </label>
  );
}

const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none";

export function RequestForm({
  categories,
  deadlineHours,
}: {
  categories: DisclosureCategory[];
  deadlineHours: number;
}) {
  const router = useRouter();
  const [agency, setAgency] = useState<RequestorAgency>("faa");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [tail, setTail] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [produced, setProduced] = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const incomplete =
    !name.trim() ||
    reason.trim().length < MIN_REASON ||
    !receivedAt ||
    !periodStart ||
    !periodEnd ||
    selected.size === 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setProduced(null);
    try {
      const response = await fetch("/api/compliance/records-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestor_name: name.trim(),
          requestor_title: title.trim() || null,
          requestor_agency: agency,
          request_reference: reference.trim() || null,
          reason: reason.trim(),
          // datetime-local has no zone; the operator is entering a
          // local wall-clock time, so it is sent as such and the
          // browser's offset makes it absolute.
          request_received_at: new Date(receivedAt).toISOString(),
          period_start: periodStart,
          period_end: periodEnd,
          aircraft_tail: tail.trim().toUpperCase() || null,
          categories: [...selected],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        let message = body;
        try {
          const parsed = JSON.parse(body);
          const detail = parsed.detail;
          message =
            typeof detail === "string"
              ? detail
              : Array.isArray(detail)
                ? detail.map((d: { msg: string }) => d.msg).join("; ")
                : body;
        } catch {
          // Not JSON — show what came back rather than swallowing it.
        }
        setError(message || `The bundle was not produced (${response.status}).`);
        return;
      }

      save(
        await response.blob(),
        filenameFrom(response.headers.get("content-disposition")),
      );
      setProduced(response.headers.get("x-disclosure-sha256"));
      router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was produced or recorded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="agency">Requesting authority</Label>
          <select
            id="agency"
            value={agency}
            onChange={(e) => setAgency(e.target.value as RequestorAgency)}
            className={FIELD}
          >
            {AGENCIES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="requestor">Requestor name</Label>
          <input
            id="requestor"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="J. Marsh"
            className={FIELD}
          />
        </div>
        <div>
          <Label htmlFor="title">Their title</Label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Aviation Safety Inspector"
            className={FIELD}
          />
        </div>
        <div>
          <Label htmlFor="reference">Their reference</Label>
          <input
            id="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="ANC-FSDO-2026-0441"
            className={FIELD}
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Their letter or docket number, so this record can be matched
            against theirs.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="received">Written request received</Label>
        <input
          id="received"
          type="datetime-local"
          value={receivedAt}
          onChange={(e) => setReceivedAt(e.target.value)}
          className={FIELD}
        />
        <p className="mt-1 text-[0.65rem] text-muted-foreground">
          When their letter arrived, not now. The {deadlineHours}-hour
          commitment is measured from this, so the record can only show
          whether it was met if this is the real time.
        </p>
      </div>

      <div>
        <Label htmlFor="reason">Reason given</Label>
        <textarea
          id="reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Routine surveillance of Part 135 operations for August 2026."
          className={FIELD}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="period-start">Period from</Label>
          <input
            id="period-start"
            type="date"
            value={periodStart}
            max={periodEnd || undefined}
            onChange={(e) => setPeriodStart(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <Label htmlFor="period-end">Period to</Label>
          <input
            id="period-end"
            type="date"
            value={periodEnd}
            min={periodStart || undefined}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <Label htmlFor="tail">Aircraft</Label>
          <input
            id="tail"
            value={tail}
            onChange={(e) => setTail(e.target.value)}
            placeholder="all aircraft"
            className={FIELD}
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Leave blank for the whole fleet. A registration we cannot
            find is refused rather than widened.
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Records to include
        </legend>
        <p className="mb-2 text-[0.65rem] text-muted-foreground">
          Only what was asked for. Selecting nothing produces nothing —
          it is not a shorthand for everything.
        </p>
        <ul className="space-y-1.5">
          {categories.map((c) => (
            <li key={c.key}>
              <label className="flex gap-2 rounded-md border border-border bg-background px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(c.key)}
                  onChange={() => toggle(c.key)}
                  aria-label={c.label}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">
                    {c.label}
                    <span className="ml-2 font-mono text-[0.6rem] font-normal text-muted-foreground">
                      {c.filename}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[0.68rem] leading-relaxed text-muted-foreground">
                    {c.detail}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || incomplete}
          title={
            incomplete
              ? "Fill in the requestor, receipt time, period and reason, and pick at least one record set"
              : undefined
          }
          className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Producing…" : "Produce and record"}
        </button>
        <p className="text-[0.7rem] text-muted-foreground">
          Producing the bundle writes the disclosure record. There is no
          way to do one without the other.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/5 px-3 py-2 text-[0.7rem] text-status-red"
        >
          {error}
        </div>
      )}
      {produced && (
        <div
          role="status"
          className="rounded-md border border-status-green/40 bg-status-green/5 px-3 py-2 text-[0.7rem] text-status-green"
        >
          Bundle produced and recorded. Archive SHA-256{" "}
          <span className="font-mono break-all">{produced}</span>
        </div>
      )}
    </div>
  );
}
