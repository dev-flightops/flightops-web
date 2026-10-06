"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { LimitProposal, LimitReading } from "@/lib/api/document-limits";

import {
  approveLimitAction,
  getReadingAction,
  readDocumentLimitsAction,
  rejectLimitAction,
} from "./document-limits-actions";

/**
 * Limits from the company's own documents (#47, M4-A-3).
 *
 * The reader looks through a manual marked as a compliance source for the
 * limits this page sets, and proposes each with the page and sentence it
 * came from. It changes nothing: a proposal waits for a Chief Pilot, DO
 * or Exec Admin, and until then the FRAT keeps the values set above.
 *
 * A reading runs on in the ai service for up to a couple of minutes, so
 * this starts one and asks after it every two seconds.
 *
 * Approving a proposal sets that limit above and keeps the document, page
 * and sentence it came from (#48); the page refreshes so the form shows
 * the new value with its source.
 */

export interface ComplianceDocument {
  id: string;
  title: string;
  version: number;
}

/** The values set now, by limit key. */
export type CurrentLimits = Record<string, number>;

const POLL_MS = 2000;
const UNREACHABLE = "Couldn't reach the server. Check the connection and try again.";
const UNITS: Record<string, string> = { kt: "kt", ft: "ft", sm: "sm" };

const FAILURES: Record<string, string> = {
  anthropic_timeout: "the reader took too long",
  anthropic_rate_limited: "the reader is busy",
  extraction_stalled: "the reading was interrupted",
  anthropic_response_truncated: "the reply was cut short",
  anthropic_response_not_json: "the reply couldn't be read",
};

export function DocumentLimitsSection({
  documents,
  latest,
  current,
}: {
  documents: ComplianceDocument[];
  latest: Record<string, LimitReading | null>;
  current: CurrentLimits;
}) {
  const uid = useId();
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? "");
  const [readings, setReadings] = useState(latest);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reading = documentId ? (readings[documentId] ?? null) : null;
  const running = reading?.status === "running";

  // A refresh after a decision brings the readings as they now stand.
  useEffect(() => {
    setReadings(latest);
  }, [latest]);

  // Ask after a running reading until it finishes.
  useEffect(() => {
    if (!reading || reading.status !== "running") return;
    const id = reading.id;
    const timer = setTimeout(async () => {
      try {
        const result = await getReadingAction(id);
        if (result.ok) {
          setReadings((all) => ({ ...all, [result.reading.document_id]: result.reading }));
        } else {
          setError(result.error);
        }
      } catch {
        setError(UNREACHABLE);
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [reading]);

  function read() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await readDocumentLimitsAction(documentId);
        if (result.ok) {
          setReadings((all) => ({ ...all, [result.reading.document_id]: result.reading }));
        } else {
          setError(result.error);
        }
      } catch {
        // A dropped request is a message here, not the page's error screen.
        setError(UNREACHABLE);
      }
    });
  }

  return (
    <section
      aria-labelledby={`${uid}-heading`}
      className="mt-6 rounded-xl border border-border bg-card p-4"
    >
      <h2 id={`${uid}-heading`} className="text-sm font-semibold">
        Limits from your documents
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The reader looks through a manual marked as a compliance source for the
        company limits the FRAT uses — crosswind by engine class, how near a limit
        counts as elevated risk, and the VFR ceiling and visibility floor — and
        proposes each with the page and sentence it came from. Nothing changes here
        until someone approves a proposal.
      </p>

      {documents.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No document is marked as a compliance source yet. Mark the GOM as one in
          the{" "}
          <Link href="/documents" className="font-semibold text-primary hover:underline">
            Document Library
          </Link>
          , then come back.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label
              htmlFor={`${uid}-document`}
              className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
            >
              Document
            </label>
            <select
              id={`${uid}-document`}
              value={documentId}
              onChange={(e) => {
                setDocumentId(e.target.value);
                setError(null);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} (version {d.version})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={read}
            disabled={pending || running || !documentId}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60"
          >
            {(pending || running) && <Spinner size="xs" />}
            {running ? "Reading…" : reading ? "Read again" : "Read limits"}
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {error}
        </p>
      )}

      {reading && (
        <ReadingResult
          reading={reading}
          current={current}
          currentVersion={documents.find((d) => d.id === documentId)?.version}
        />
      )}
    </section>
  );
}

function ReadingResult({
  reading,
  current,
  currentVersion,
}: {
  reading: LimitReading;
  current: CurrentLimits;
  /** The document's version now; a reading of an older one is out of date (#49). */
  currentVersion?: number;
}) {
  if (reading.status === "running") {
    return (
      <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner size="xs" />
        Reading {reading.document_title} version {reading.version_number}. This takes up
        to a minute.
      </p>
    );
  }
  if (reading.status === "failed") {
    return (
      <p
        role="alert"
        className="mt-3 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
      >
        The last reading failed: {FAILURES[reading.error ?? ""] ?? "something went wrong"}.
        Read it again.
      </p>
    );
  }
  const found = reading.proposals_found ?? reading.proposals.length;
  const dropped = reading.proposals_dropped ?? 0;
  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground">
        Version {reading.version_number}, read
        {reading.finished_at ? ` on ${reading.finished_at.slice(0, 10)}` : ""}
        {reading.requested_by_name ? ` (asked by ${reading.requested_by_name})` : ""}:{" "}
        {found} limit{found === 1 ? "" : "s"} found on {reading.pages_read ?? 0} page
        {reading.pages_read === 1 ? "" : "s"} that mention wind or weather.
        {dropped > 0
          ? ` ${dropped} more set aside: the sentence quoted wasn't on its page, or the value didn't fit the setting.`
          : ""}
      </p>
      {currentVersion !== undefined && reading.version_number < currentVersion && (
        <p className="mt-1 text-xs font-semibold text-status-yellow">
          Version {currentVersion} is the current version. Read again to check the limits
          against it.
        </p>
      )}
      {reading.proposals.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-[0.6rem] uppercase tracking-[0.06em] text-muted-foreground">
                <th scope="col" className="px-3 py-2">Limit</th>
                <th scope="col" className="px-3 py-2">In the document</th>
                <th scope="col" className="px-3 py-2">Set here now</th>
                <th scope="col" className="px-3 py-2">Where</th>
                <th scope="col" className="px-3 py-2">Decision</th>
              </tr>
            </thead>
            <tbody>
              {reading.proposals.map((p) => {
                const proposed = Number(p.value);
                const now = current[p.limit_key];
                const same = now !== undefined && Number(now) === proposed;
                return (
                  <tr key={p.id} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-3 py-2 font-semibold">
                      {p.label}
                      {/* What it applies to, unless the name already says it. */}
                      {p.applies_to &&
                        !p.label.toLowerCase().includes(p.applies_to.toLowerCase()) && (
                          <span className="block font-normal text-muted-foreground">
                            {p.applies_to}
                          </span>
                        )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {amount(proposed, p.unit)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {now === undefined ? (
                        "—"
                      ) : (
                        <>
                          <span className="font-mono">{amount(Number(now), p.unit)}</span>{" "}
                          <span
                            className={
                              "rounded px-1 text-[0.6rem] font-semibold uppercase " +
                              (same
                                ? "bg-status-green/15 text-status-green"
                                : "bg-status-yellow/15 text-status-yellow")
                            }
                          >
                            {same ? "same" : "differs"}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-semibold">Page {p.page_number}</span>
                      <q className="mt-0.5 block italic text-muted-foreground">{p.quote}</q>
                    </td>
                    <td className="px-3 py-2">
                      <Decision proposal={p} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Approving sets the limit above and keeps the page and sentence it came from.
        Change it by hand later and it no longer claims the document&rsquo;s backing.
      </p>
    </div>
  );
}

function amount(value: number, unit: string): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${UNITS[unit] ?? unit}`;
}

/** Approve as read, approve a corrected value, or reject (#48). */
function Decision({ proposal }: { proposal: LimitProposal }) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  const [value, setValue] = useState(String(Number(proposal.value)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (proposal.status === "approved") {
    const applied = Number(proposal.approved_value ?? proposal.value);
    return (
      <span className="text-status-green">
        Approved{proposal.reviewed_by_name ? ` by ${proposal.reviewed_by_name}` : ""}
        <span className="block font-mono">{amount(applied, proposal.unit)} applied</span>
      </span>
    );
  }
  if (proposal.status === "rejected") {
    return (
      <span className="text-muted-foreground">
        Rejected{proposal.reviewed_by_name ? ` by ${proposal.reviewed_by_name}` : ""}
      </span>
    );
  }
  if (proposal.status === "superseded") {
    return <span className="text-muted-foreground">Replaced by a newer decision</span>;
  }

  function decide(run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await run();
        if (result.ok) {
          setChanging(false);
          router.refresh();
        } else {
          setError(result.error ?? "Try again.");
        }
      } catch {
        setError(UNREACHABLE);
      }
    });
  }

  const button =
    "rounded-md border px-2 py-1 text-[0.7rem] font-semibold disabled:opacity-60";
  return (
    <div className="min-w-[9rem] space-y-1.5">
      {changing ? (
        <div className="flex items-center gap-1">
          <input
            aria-label={`Value to approve for ${proposal.label}`}
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(() => approveLimitAction(proposal.id, value))}
            className={`${button} border-primary/50 bg-primary text-primary-foreground`}
          >
            Approve {value}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setChanging(false)}
            className={`${button} border-border`}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(() => approveLimitAction(proposal.id))}
            className={`${button} border-primary/50 bg-primary text-primary-foreground`}
            aria-label={`Approve ${proposal.label}: ${amount(Number(proposal.value), proposal.unit)}`}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setChanging(true)}
            className={`${button} border-border`}
            aria-label={`Change ${proposal.label} before approving`}
          >
            Change…
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => decide(() => rejectLimitAction(proposal.id))}
            className={`${button} border-border text-status-red`}
            aria-label={`Reject ${proposal.label}`}
          >
            Reject
          </button>
        </div>
      )}
      {pending && <Spinner size="xs" />}
      {error && (
        <p role="alert" className="text-[0.68rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
