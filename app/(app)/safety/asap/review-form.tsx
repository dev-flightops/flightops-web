"use client";

import { useActionState, useEffect, useRef } from "react";

import { ASAP_DECISIONS, ASAP_DECISION_LABELS, type AsapReview } from "@/lib/api/asap";
import { todayIsoDay } from "@/lib/iso-day";

import { saveAsapReviewAction, type AsapReviewState } from "./actions";

const _initial: AsapReviewState = { status: "idle", attempt: 0 };

const FIELD = "ff-input text-xs";

/**
 * Legacy's "File ERC review" / "Update review" form under each ASAP
 * report: review date, decision, participants, rationale, corrective
 * action or feedback to the reporter, de-identified.
 */
export function AsapReviewForm({ reportId, review }: { reportId: string; review: AsapReview | null }) {
  const [state, formAction, pending] = useActionState(saveAsapReviewAction, _initial);
  // Remounted after every save: from the saved review when it worked,
  // from what was sent when it did not.
  const sent = state.status === "error" ? state.values : undefined;
  const value = (key: string, saved: string) => sent?.[key] ?? saved;
  // A first review defaults to the reviewer's own day. The server would
  // use its UTC day, which an Alaska evening has already left.
  const dateRef = useRef<HTMLInputElement>(null);
  const needsDefault = !review && !sent?.review_date;
  useEffect(() => {
    if (needsDefault && dateRef.current && !dateRef.current.value) {
      dateRef.current.value = todayIsoDay();
    }
  }, [needsDefault, state.attempt]);

  return (
    <form
      key={`${review?.updated_at ?? "new"}:${state.attempt}`}
      action={formAction}
      className="mt-3 grid gap-2 md:grid-cols-2"
    >
      <input type="hidden" name="report_id" value={reportId} />
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red md:col-span-2"
        >
          {state.message}
        </div>
      ) : null}
      {state.status === "ok" ? (
        <p role="status" className="text-xs font-semibold text-status-green md:col-span-2">
          Saved.
        </p>
      ) : null}

      <label className="min-w-0">
        <span className="sr-only">Review date</span>
        <input
          ref={dateRef}
          type="date"
          name="review_date"
          defaultValue={value("review_date", review?.review_date ?? "")}
          aria-label="Review date"
          className={FIELD}
        />
      </label>
      <label className="min-w-0">
        <span className="sr-only">Decision</span>
        <select
          name="decision"
          defaultValue={value("decision", review?.decision ?? "pending")}
          aria-label="Decision"
          className={FIELD}
        >
          {ASAP_DECISIONS.map((d) => (
            <option key={d} value={d}>
              {ASAP_DECISION_LABELS[d]}
            </option>
          ))}
        </select>
      </label>
      <input
        type="text"
        name="erc_participants"
        maxLength={2000}
        defaultValue={value("erc_participants", review?.erc_participants ?? "")}
        placeholder="ERC Participants (Company Rep, FAA Rep, Union Rep)"
        aria-label="ERC participants"
        className={`${FIELD} md:col-span-2`}
      />
      <textarea
        name="decision_rationale"
        rows={2}
        maxLength={10000}
        defaultValue={value("decision_rationale", review?.decision_rationale ?? "")}
        placeholder="Rationale for decision..."
        aria-label="Rationale for decision"
        className={`${FIELD} md:col-span-2`}
      />
      <textarea
        name="corrective_action_summary"
        rows={2}
        maxLength={10000}
        defaultValue={value("corrective_action_summary", review?.corrective_action_summary ?? "")}
        placeholder="Corrective actions / feedback to reporter..."
        aria-label="Corrective actions or feedback to reporter"
        className={`${FIELD} md:col-span-2`}
      />
      <label className="flex items-center gap-2 text-xs md:col-span-2">
        <input
          type="checkbox"
          name="de_identified"
          defaultChecked={sent ? sent.de_identified === "on" : (review?.de_identified ?? false)}
          className="accent-primary"
        />
        De-identified before internal distribution
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60 md:col-span-2"
      >
        {pending ? "Saving…" : "Save Review"}
      </button>
    </form>
  );
}
