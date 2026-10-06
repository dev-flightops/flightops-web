"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { LimitReading } from "@/lib/api/document-limits";

import { getReadingAction, readDocumentLimitsAction } from "./document-limits-actions";

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
 */

export interface ComplianceDocument {
  id: string;
  title: string;
  version: number;
}

/** The values set now, by limit key. */
export type CurrentLimits = Record<string, number>;

const POLL_MS = 2000;
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

  // Ask after a running reading until it finishes.
  useEffect(() => {
    if (!reading || reading.status !== "running") return;
    const id = reading.id;
    const timer = setTimeout(async () => {
      const result = await getReadingAction(id);
      if (result.ok) {
        setReadings((all) => ({ ...all, [result.reading.document_id]: result.reading }));
      } else {
        setError(result.error);
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [reading]);

  function read() {
    setError(null);
    startTransition(async () => {
      const result = await readDocumentLimitsAction(documentId);
      if (result.ok) {
        setReadings((all) => ({ ...all, [result.reading.document_id]: result.reading }));
      } else {
        setError(result.error);
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

      {reading && <ReadingResult reading={reading} current={current} />}
    </section>
  );
}

function ReadingResult({ reading, current }: { reading: LimitReading; current: CurrentLimits }) {
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
      {reading.proposals.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-[0.6rem] uppercase tracking-[0.06em] text-muted-foreground">
                <th scope="col" className="px-3 py-2">Limit</th>
                <th scope="col" className="px-3 py-2">In the document</th>
                <th scope="col" className="px-3 py-2">Set here now</th>
                <th scope="col" className="px-3 py-2">Where</th>
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
                      {p.applies_to && (
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        Proposals wait for approval. Until a proposal is approved, the FRAT keeps the
        values set above.
      </p>
    </div>
  );
}

function amount(value: number, unit: string): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${UNITS[unit] ?? unit}`;
}
