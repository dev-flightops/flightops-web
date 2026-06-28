"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import type { CpReviewAction } from "@/lib/api/types";

import {
  approveCpReviewAction,
  declineCpReviewAction,
} from "./decide-actions";

/**
 * Inline approve/decline pair for a row in the CP review queue.
 *
 * First click expands an inline panel with an optional note + the
 * specific decision button. Approving fires the underlying reopen /
 * delete on the flight log under CP authority; declining leaves the
 * log alone.
 *
 * Note is optional (matches the backend), but the panel encourages
 * it — auditors want a paper trail of WHY.
 */
export function CpReviewDecideButtons({
  reviewId,
  action,
}: {
  reviewId: string;
  action: CpReviewAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"approve" | "decline" | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (open === null) {
    return (
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen("approve");
          }}
          className="rounded-md border border-status-green/40 bg-status-green/10 px-2.5 py-1 text-[0.65rem] font-semibold text-status-green hover:bg-status-green/20"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setOpen("decline");
          }}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-[0.65rem] font-semibold text-foreground hover:bg-muted"
        >
          Decline
        </button>
      </div>
    );
  }

  const isApprove = open === "approve";
  const heading = isApprove
    ? action === "reopen"
      ? "Approve reopen?"
      : "Approve delete?"
    : "Decline this request?";
  const subhead = isApprove
    ? action === "reopen"
      ? "The log returns to draft so the pilot can edit it."
      : "The log is soft-deleted. The audit row stays for review."
    : "The pilot can open a fresh request if circumstances change.";
  const confirmCls = isApprove
    ? "bg-status-green text-white hover:brightness-110"
    : "bg-status-yellow text-black hover:brightness-110";

  return (
    <div className="rounded-md border border-border bg-card p-2 text-[0.65rem] shadow-sm">
      <div className="font-semibold text-foreground">{heading}</div>
      <p className="mt-0.5 text-muted-foreground">{subhead}</p>
      <label className="mt-1.5 block">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Note (optional)
        </span>
        <input
          type="text"
          value={note}
          maxLength={2000}
          disabled={pending}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Short rationale for the audit chain"
          className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 disabled:opacity-60"
        />
      </label>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const fn = isApprove
                ? approveCpReviewAction
                : declineCpReviewAction;
              const result = await fn(reviewId, note);
              if (result.status === "error") {
                setError(result.message);
                return;
              }
              setOpen(null);
              setNote("");
              router.refresh();
            });
          }}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold disabled:opacity-50 ${confirmCls}`}
        >
          {pending && <Spinner size="xs" />}
          {isApprove ? "Approve" : "Decline"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(null);
            setNote("");
            setError(null);
          }}
          className="rounded-md border border-border bg-background px-2.5 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
