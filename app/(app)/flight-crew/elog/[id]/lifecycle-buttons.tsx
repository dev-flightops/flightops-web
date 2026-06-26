"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

import {
  deleteFlightLogAction,
  reopenFlightLogAction,
} from "./lifecycle-actions";

/**
 * M2-M-10 — Reopen + Delete buttons for the elog detail header.
 *
 * Both fire server actions that audit the event. The reason
 * textarea is optional (matches the backend); auditors prefer one
 * but the action accepts null. After reopen the page re-renders
 * with status='draft'; after delete the action redirects back to
 * the elog index (the row is now soft-deleted and 404s on GET).
 *
 * Window logic stays client-side as a soft guard: if `submittedAt`
 * is more than 90 days ago we hide the Reopen / Delete buttons
 * rather than show a click that's guaranteed to 409. The server
 * still enforces the cutoff — the UI doesn't trust client clocks.
 */

const REOPEN_WINDOW_DAYS = 90;

export function LifecycleButtons({
  logId,
  status,
  submittedAt,
}: {
  logId: string;
  status: "draft" | "submitted";
  submittedAt: string | null;
}) {
  const withinWindow = isWithinReopenWindow(submittedAt);
  const canReopen = status === "submitted" && withinWindow;
  // Drafts can always be deleted by the creator. Submitted logs only
  // within the 90-day window.
  const canDelete = status === "draft" || (status === "submitted" && withinWindow);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canReopen && (
        <LifecyclePrompt
          variant="reopen"
          buttonLabel="Reopen"
          panelTitle="Reopen this log for editing?"
          confirmLabel="Reopen"
          action={(reason) => reopenFlightLogAction(logId, reason)}
          afterSuccess="refresh"
        />
      )}
      {canDelete && (
        <LifecyclePrompt
          variant="delete"
          buttonLabel="Delete"
          panelTitle="Delete this log?"
          confirmLabel="Delete"
          action={(reason) => deleteFlightLogAction(logId, reason)}
          afterSuccess="none"
        />
      )}
    </div>
  );
}

function LifecyclePrompt({
  variant,
  buttonLabel,
  panelTitle,
  confirmLabel,
  action,
  afterSuccess,
}: {
  variant: "reopen" | "delete";
  buttonLabel: string;
  panelTitle: string;
  confirmLabel: string;
  action: (reason: string | null) => Promise<
    { status: "ok" } | { status: "error"; message: string }
  >;
  afterSuccess: "refresh" | "none";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const triggerCls =
    variant === "reopen"
      ? "border border-status-yellow/40 bg-status-yellow/10 text-status-yellow hover:bg-status-yellow/20"
      : "border border-status-red/40 bg-status-red/10 text-status-red hover:bg-status-red/20";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${triggerCls}`}
      >
        {buttonLabel}
      </button>
    );
  }

  const confirmCls =
    variant === "reopen"
      ? "bg-status-yellow text-black hover:brightness-110"
      : "bg-status-red text-white hover:brightness-110";

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-foreground">{panelTitle}</div>
      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
        {variant === "reopen"
          ? "The log returns to draft so you can edit it. A new 90-day window starts when you re-submit."
          : "The log is soft-deleted and hidden from history. The audit row stays for compliance review."}
      </p>
      <label className="mt-2 block">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Reason (optional)
        </span>
        <textarea
          value={reason}
          maxLength={2000}
          rows={2}
          disabled={pending}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground disabled:opacity-60"
          placeholder="Why are you taking this action?"
        />
      </label>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const trimmed = reason.trim();
              const payload = trimmed === "" ? null : trimmed;
              const result = await action(payload);
              if (result.status === "error") {
                setError(result.message);
                return;
              }
              if (afterSuccess === "refresh") {
                setOpen(false);
                router.refresh();
              }
              // For "none", the server action redirects on its own.
            });
          }}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${confirmCls}`}
        >
          {pending && <Spinner size="xs" />}
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

function isWithinReopenWindow(submittedAt: string | null): boolean {
  if (!submittedAt) return true; // never submitted (draft) — no window to enforce
  const submitted = Date.parse(submittedAt);
  if (Number.isNaN(submitted)) return false;
  const ageMs = Date.now() - submitted;
  return ageMs <= REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
