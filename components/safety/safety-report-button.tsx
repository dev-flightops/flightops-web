"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { fileSafetyReportAction, type FileSafetyReportResult } from "./actions";

const SEVERITIES = [
  { value: "low", label: "Low — informational" },
  { value: "medium", label: "Medium — hazard worth tracking" },
  { value: "high", label: "High — operational risk" },
  { value: "critical", label: "Critical — immediate attention" },
] as const;

/**
 * Floating red Safety Report button — fixed bottom-right of every
 * authenticated page per the formal Home Page spec, Component 6:
 *
 *   "The red Safety Report button is fixed to the bottom-right corner
 *    of every page in the app — including the home page. It is always
 *    visible regardless of scroll position. All roles see it at all
 *    times."
 *
 * The button itself ships today; the actual safety-service backend
 * (safety_reports table, anonymous user_id stripping, ASAP-style
 * routing) is M3. Submit calls a stub server action that returns
 * success without persisting — the modal shows a success state so the
 * UX path is testable end-to-end, with a clear note that storage lands
 * with safety-service.
 */
export function SafetyReportButton() {
  const [open, setOpen] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]["value"]>(
    "medium",
  );
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<FileSafetyReportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setAnonymous(false);
    setSeverity("medium");
    setDescription("");
    setResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await fileSafetyReportAction({
        description,
        severity,
        anonymous,
      });
      setResult(res);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        aria-label="File a safety report"
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-1.5 rounded-full border border-status-red bg-status-red px-4 py-2.5 text-xs font-bold uppercase tracking-[0.05em] text-white shadow-lg shadow-status-red/40 transition-transform hover:-translate-y-0.5 hover:bg-status-red/90"
      >
        <span aria-hidden>🛡</span> Safety
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!isPending) setOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>File a safety report</DialogTitle>
            <DialogDescription>
              Confidential by default. Anonymous reports strip your user id
              before the record is saved.
            </DialogDescription>
          </DialogHeader>

          {result?.status === "ok" ? (
            <SuccessPanel onClose={() => setOpen(false)} />
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

              <div>
                <label
                  htmlFor="safety-description"
                  className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  What happened?
                </label>
                <textarea
                  id="safety-description"
                  required
                  minLength={10}
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the hazard, near-miss, or concern. Be specific about who, what, where, when."
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-red focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="safety-severity"
                  className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  Severity
                </label>
                <select
                  id="safety-severity"
                  value={severity}
                  onChange={(e) =>
                    setSeverity(
                      e.target.value as (typeof SEVERITIES)[number]["value"],
                    )
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-red focus:outline-none"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
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
                Safety service lands in M3; submissions today are
                acknowledged but not yet persisted. Filing this report
                still records that you tried.
              </p>

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
                  disabled={isPending || description.length < 10}
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

function SuccessPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="rounded-md border border-status-green/40 bg-status-green/[0.08] px-4 py-3 text-sm text-status-green"
      >
        <p className="font-semibold">✓ Report acknowledged.</p>
        <p className="mt-1 text-xs text-status-green/80">
          Real submission persists to <code>safety_reports</code> when the
          safety-service ships (M3). Until then your filing has been
          recorded in the session log only.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </div>
  );
}
