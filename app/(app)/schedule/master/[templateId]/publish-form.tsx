"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import type { PublishResult } from "@/lib/api/master-schedule";
import { localDate } from "@/lib/format/local-time";

import { publishAction, type PublishFormState } from "../actions";

const _initial: PublishFormState = { status: "idle", attempt: 0 };

function day(iso: string): string {
  return localDate(`${iso}T12:00:00Z`, "UTC", { withYear: true });
}

function flights(n: number): string {
  return `${n} flight${n === 1 ? "" : "s"}`;
}

/**
 * Publish to a date range (legacy's `template_detail.html`). Preview first: it
 * says what the dates would add and what can't be added, and Publish then
 * stands for exactly that. Changing a date asks for the preview again.
 */
export function PublishForm({
  templateId,
  defaultName,
  defaultStart,
}: {
  templateId: string;
  defaultName: string;
  defaultStart: string;
}) {
  const [state, action, pending] = useActionState(publishAction, _initial);
  const [name, setName] = useState(defaultName);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState("");
  const current =
    state.values?.start_date === start && state.values?.end_date === end && state.values?.name === name.trim();
  const result = current ? state.result : undefined;

  return (
    <form action={action} aria-label="Publish to date range" className="space-y-4">
      <input type="hidden" name="template_id" value={templateId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="field-label">Name</span>
          <input
            name="name"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ff-input px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="field-label">Start date</span>
          <input
            name="start_date"
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="ff-input px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="field-label">End date</span>
          <input
            name="end_date"
            type="date"
            required
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
            className="ff-input px-3 py-2 text-sm"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        A flight number already on a date is left as it is, so a flight moved or cancelled stays that way and the same
        dates can be published again. Changing this schedule later doesn&rsquo;t change flights already published.
      </p>

      {state.status === "error" && current ? (
        <p role="alert" className="field-error">
          {state.message}
        </p>
      ) : null}
      {result && state.status === "preview" ? <Preview result={result} /> : null}
      {result && state.status === "published" ? <Published result={result} /> : null}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          name="intent"
          value="preview"
          disabled={pending}
          className={`${state.status === "preview" && result ? buttonOutline : buttonSolid} disabled:opacity-60`}
        >
          {pending ? "Working…" : "Preview"}
        </button>
        {state.status === "preview" && result && result.flights > 0 ? (
          <button type="submit" name="intent" value="publish" disabled={pending} className={`${buttonSolid} disabled:opacity-60`}>
            Publish {flights(result.flights)}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Problems({ result }: { result: PublishResult }) {
  if (result.problem_count === 0) return null;
  return (
    <Notice tone="yellow" label="Can&rsquo;t be added">
      {flights(result.problem_count)}:
      <ul className="mt-1 space-y-0.5">
        {result.problems.map((problem, i) => (
          <li key={i}>
            {day(problem.date)} {problem.flight_number}: {problem.message}
          </li>
        ))}
        {result.problem_count > result.problems.length ? (
          <li>and {result.problem_count - result.problems.length} more</li>
        ) : null}
      </ul>
    </Notice>
  );
}

function Preview({ result }: { result: PublishResult }) {
  const there = result.already_there > 0 ? ` ${flights(result.already_there)} already there stay as they are.` : "";
  return (
    <div className="space-y-2">
      <Notice tone={result.flights > 0 ? "blue" : "gray"} label="Preview" role="status">
        {result.flights > 0 && result.first_date && result.last_date
          ? `Adds ${flights(result.flights)}, ${day(result.first_date)} to ${day(result.last_date)}: ${result.by_flight
              .map((f) => `${f.flight_number} × ${f.count}`)
              .join(", ")}.${there}`
          : `Nothing to add.${there}`}
      </Notice>
      <Problems result={result} />
    </div>
  );
}

function Published({ result }: { result: PublishResult }) {
  const there = result.already_there > 0 ? ` ${flights(result.already_there)} already there stayed as they are.` : "";
  return (
    <div className="space-y-2">
      <Notice tone={result.flights > 0 ? "green" : "gray"} label="Published" role="status">
        {result.flights > 0 ? `${flights(result.flights)} added.${there} ` : `Nothing to add.${there} `}
        {result.first_date ? (
          <Link href={`/schedule?date=${result.first_date}`} className={linkCaps}>
            Open the Schedule <span aria-hidden>›</span>
          </Link>
        ) : null}
      </Notice>
      <Problems result={result} />
    </div>
  );
}
