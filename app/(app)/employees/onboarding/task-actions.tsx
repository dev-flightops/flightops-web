"use client";

import { useRef, useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import type { AssignmentTask, TaskStatus } from "@/lib/api/onboarding";
import { isDone } from "@/lib/onboarding/options";

import { fileTaskDocumentAction, setTaskStatusAction } from "./actions";

/**
 * What can be done to one onboarding task (#180): done, in progress, skipped
 * with a reason, reopened. A Document Upload task is done by uploading its
 * document, which files it in the employee's Documents, or by using the one
 * already on file.
 */
export function TaskActions({ assignmentId, task }: { assignmentId: string; task: AssignmentTask }) {
  const [open, setOpen] = useState<"skip" | "upload" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  if (!task.can_act) return null;

  const set = (status: TaskStatus, notes = "") =>
    startTransition(async () => {
      setError(null);
      const result = await setTaskStatusAction(assignmentId, task.id, status, notes);
      if (result.ok) {
        setOpen(null);
        setReason("");
      } else setError(result.message);
    });

  const upload = () =>
    startTransition(async () => {
      setError(null);
      if (!form.current) return;
      const result = await fileTaskDocumentAction(assignmentId, task.id, new FormData(form.current));
      if (result.ok) setOpen(null);
      else setError(result.message);
    });

  const isUpload = task.task_type === "document_upload";
  const requirement = task.document_requirement;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {isDone(task.status) ? (
          <button
            type="button"
            className={linkCaps}
            disabled={pending}
            aria-label={`Reopen: ${task.name}`}
            onClick={() => set("pending")}
          >
            Reopen
          </button>
        ) : (
          <>
            {isUpload ? (
              <button
                type="button"
                className={buttonSolid}
                disabled={pending}
                aria-label={`Upload: ${task.name}`}
                onClick={() => setOpen(open === "upload" ? null : "upload")}
              >
                Upload
              </button>
            ) : (
              <button
                type="button"
                className={buttonSolid}
                disabled={pending}
                aria-label={`Done: ${task.name}`}
                onClick={() => set("complete")}
              >
                Done
              </button>
            )}
            {task.status === "pending" ? (
              <button
                type="button"
                className={buttonOutline}
                disabled={pending}
                aria-label={`Started: ${task.name}`}
                onClick={() => set("in_progress")}
              >
                Started
              </button>
            ) : null}
            <button
              type="button"
              className={linkCaps}
              disabled={pending}
              aria-label={`Skip: ${task.name}`}
              onClick={() => setOpen(open === "skip" ? null : "skip")}
            >
              Skip
            </button>
          </>
        )}
      </div>

      {open === "skip" ? (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <label htmlFor={`skip-${task.id}`} className="field-label">
            Why it&apos;s skipped
          </label>
          <input
            id={`skip-${task.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={4000}
            className="ff-input px-3 py-2 text-sm"
          />
          <button type="button" className={buttonOutline} disabled={pending} onClick={() => set("skipped", reason)}>
            Skip Task
          </button>
        </div>
      ) : null}

      {open === "upload" && requirement ? (
        <form
          ref={form}
          method="post"
          aria-label={`Upload ${requirement.name}`}
          className="flex w-full max-w-sm flex-col gap-2 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            upload();
          }}
        >
          <p className="text-xs text-muted-foreground">
            Filed in the employee&apos;s Documents as {requirement.name}.
          </p>
          <label htmlFor={`file-${task.id}`} className="field-label">
            File
          </label>
          <input id={`file-${task.id}`} name="file" type="file" required className="text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`issued-${task.id}`} className="field-label">
                Issued
              </label>
              <input id={`issued-${task.id}`} name="issued_on" type="date" className="ff-input w-full px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label htmlFor={`expires-${task.id}`} className="field-label">
                Expires{requirement.has_expiry ? <span className="text-status-red"> *</span> : null}
              </label>
              <input
                id={`expires-${task.id}`}
                name="expires_on"
                type="date"
                required={requirement.has_expiry}
                className="ff-input w-full px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={linkCaps}
              disabled={pending}
              onClick={() => set("complete")}
              title={`Done with the ${requirement.name} already in their Documents`}
            >
              Use the one on file
            </button>
            <button type="submit" className={buttonSolid} disabled={pending}>
              {pending ? "Uploading…" : "Upload & File"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="field-error max-w-sm text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}
