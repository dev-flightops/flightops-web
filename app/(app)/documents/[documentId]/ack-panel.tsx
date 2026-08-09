"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { acknowledgeDocumentAction } from "../actions";

interface Props {
  documentId: string;
  currentVersionNumber: number;
  initialAcknowledged: boolean;
  initialAcknowledgedAt: string | null;
  initialAcknowledgedVersionNumber: number | null;
}

/**
 * Ack panel for a required-reading document. Three visible states:
 *   • already acked current version → green "You acknowledged this on <date>"
 *   • acked an OLDER version → yellow "Rev N — please re-acknowledge"
 *   • never acked → blue call-to-action w/ "I've read this" button
 *
 * The panel is shown only when the document has requires_acknowledgment=true;
 * the server page decides whether to render it at all.
 */
export function AckPanel({
  documentId,
  currentVersionNumber,
  initialAcknowledged,
  initialAcknowledgedAt,
  initialAcknowledgedVersionNumber,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acked, setAcked] = useState(initialAcknowledged);
  const [ackedAt, setAckedAt] = useState<string | null>(
    initialAcknowledgedAt,
  );
  const [error, setError] = useState<string | null>(null);

  const staleAck =
    !acked &&
    initialAcknowledgedVersionNumber !== null &&
    initialAcknowledgedVersionNumber < currentVersionNumber;

  function onAck() {
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeDocumentAction(documentId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't record acknowledgment.");
        return;
      }
      setAcked(true);
      setAckedAt(new Date().toISOString());
      router.refresh();
    });
  }

  if (acked) {
    return (
      <div
        role="status"
        className="mb-5 flex items-start gap-3 rounded-lg border border-status-green/40 bg-status-green/10 px-4 py-3"
      >
        <CheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-green" />
        <div className="text-sm">
          <p className="font-semibold text-status-green">
            You acknowledged this document
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ackedAt ? fmtWhen(ackedAt) : "Just now"} · v
            {currentVersionNumber}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "mb-5 rounded-lg border px-4 py-3 " +
        (staleAck
          ? "border-status-yellow/40 bg-status-yellow/10"
          : "border-status-blue/40 bg-status-blue/10")
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p
            className={
              "font-semibold " +
              (staleAck ? "text-status-yellow" : "text-status-blue")
            }
          >
            {staleAck
              ? `Revised — please re-acknowledge v${currentVersionNumber}`
              : "Required reading — acknowledgment needed"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {staleAck
              ? `Your prior acknowledgment (v${initialAcknowledgedVersionNumber}) is out of date.`
              : "Read the current version, then confirm below. This ack is logged for audit."}
          </p>
        </div>
        <button
          type="button"
          onClick={onAck}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-status-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Recording…" : "I've read this"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 011.415-1.42L8.5 12.086l6.79-6.797a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
