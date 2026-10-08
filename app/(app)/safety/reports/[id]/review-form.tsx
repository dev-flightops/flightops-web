"use client";

import { useActionState } from "react";

import {
  LIKELIHOOD_LABELS,
  RISK_SCALE,
  SAFETY_REPORT_STATUSES,
  SAFETY_REPORT_STATUS_LABELS,
  SEVERITY_LABELS,
  type SafetyReport,
} from "@/lib/api/safety-reports";

import { reviewSafetyReportAction, type ReviewState } from "./actions";

const _initial: ReviewState = { status: "idle", attempt: 0 };

export interface AssigneeOption {
  id: string;
  full_name: string;
}

/**
 * Legacy's "Update Status" panel, plus the risk assessment, which is the
 * safety team's to set or revise (#58): legacy kept the reporter's guess.
 * The assignee is picked from the safety team rather than typed.
 */
export function ReviewForm({
  report,
  assignees,
}: {
  report: SafetyReport;
  assignees: AssigneeOption[];
}) {
  const [state, formAction, pending] = useActionState(reviewSafetyReportAction, _initial);
  // Remounted after every completed review: from the saved report when
  // it worked, from what was sent when it did not.
  const sent = state.status === "error" ? state.values : undefined;
  const value = (key: string, saved: string) => sent?.[key] ?? saved;
  const assignee = report.assigned_to;
  // Someone assigned before they left the safety team is still shown.
  const options =
    assignee && !assignees.some((a) => a.id === assignee.id)
      ? [...assignees, { id: assignee.id, full_name: assignee.full_name }]
      : assignees;

  return (
    <form
      key={`${report.updated_at}:${state.attempt}`}
      action={formAction}
      className="space-y-3"
    >
      <input type="hidden" name="report_id" value={report.id} />
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}
      {state.status === "ok" ? (
        <p role="status" className="text-xs font-semibold text-status-green">
          Saved.
        </p>
      ) : null}

      <Select label="Status" name="status" defaultValue={value("status", report.status)}>
        {SAFETY_REPORT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SAFETY_REPORT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select
        label="Assigned To"
        name="assigned_to_user_id"
        defaultValue={value("assigned_to_user_id", assignee?.id ?? "")}
      >
        <option value="">Unassigned</option>
        {options.map((a) => (
          <option key={a.id} value={a.id}>
            {a.full_name}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Severity" name="severity" defaultValue={value("severity", String(report.severity ?? ""))}>
          <option value="">—</option>
          {RISK_SCALE.map((n) => (
            <option key={n} value={n}>
              {n} — {SEVERITY_LABELS[n]}
            </option>
          ))}
        </Select>
        <Select
          label="Likelihood"
          name="likelihood"
          defaultValue={value("likelihood", String(report.likelihood ?? ""))}
        >
          <option value="">—</option>
          {RISK_SCALE.map((n) => (
            <option key={n} value={n}>
              {n} — {LIKELIHOOD_LABELS[n]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label
          htmlFor="resolution"
          className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Resolution
        </label>
        <textarea
          id="resolution"
          name="resolution"
          rows={3}
          maxLength={10000}
          defaultValue={value("resolution", report.resolution ?? "")}
          className="ff-input"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update"}
      </button>
    </form>
  );
}

function Select({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
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
      <select id={name} name={name} defaultValue={defaultValue} className="ff-input">
        {children}
      </select>
    </div>
  );
}
