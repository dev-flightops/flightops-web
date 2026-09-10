"use client";

import { useState } from "react";

import type { InvoiceStatus } from "@/lib/api/customer-invoices";

import {
  invoicePdfAction,
  markPaidAction,
  sendInvoiceAction,
  voidInvoiceAction,
  type InvoiceActionState,
} from "../actions";

/**
 * Send, mark paid, void, and download.
 *
 * Only the transitions the service will accept are offered. The
 * service is the authority — it refuses the rest with a 409 — but
 * showing a button that always fails teaches somebody the system is
 * broken rather than that the action is not available. Legacy offered
 * all four on every invoice.
 *
 * Send is withheld on an unpriced invoice for the same reason, with
 * the explanation in place of the button rather than in an error after
 * clicking it.
 */
export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  status,
  hasUnpricedLines,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  hasUnpricedLines: boolean;
}) {
  const [state, setState] = useState<InvoiceActionState>({ status: "idle" });
  const [pending, setPending] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");

  async function run(name: string, fn: () => Promise<InvoiceActionState>) {
    setPending(name);
    setState({ status: "idle" });
    setState(await fn());
    setPending(null);
  }

  async function download() {
    setPending("pdf");
    setState({ status: "idle" });
    const result = await invoicePdfAction(invoiceId, invoiceNumber);
    setPending(null);
    if (result.status !== "ok") {
      setState({ status: "error", message: result.message });
      return;
    }
    // Base64 to bytes to a Blob. Decoded here rather than server-side
    // because a Buffer does not survive the server-action boundary.
    const bytes = Uint8Array.from(atob(result.base64), (c) =>
      c.charCodeAt(0),
    );
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Left unrevoked, every download leaks the file until the tab
    // closes.
    URL.revokeObjectURL(url);
  }

  const canSend = status === "draft";
  const canMarkPaid = status === "sent";
  const canVoid = status === "draft" || status === "sent";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void download()}
          disabled={pending !== null}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-50"
        >
          {pending === "pdf" ? "Building…" : "Download PDF"}
        </button>

        {canSend && !hasUnpricedLines && (
          <button
            type="button"
            onClick={() =>
              void run("send", () => sendInvoiceAction(invoiceId))
            }
            disabled={pending !== null}
            className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {pending === "send" ? "Sending…" : "Send"}
          </button>
        )}

        {canMarkPaid && (
          <button
            type="button"
            onClick={() =>
              void run("paid", () => markPaidAction(invoiceId, ""))
            }
            disabled={pending !== null}
            className="rounded-md bg-status-green px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {pending === "paid" ? "Recording…" : "Mark paid"}
          </button>
        )}

        {canVoid && !voiding && (
          <button
            type="button"
            onClick={() => setVoiding(true)}
            disabled={pending !== null}
            className="rounded-md border border-status-red/40 px-3 py-1.5 text-xs font-semibold text-status-red hover:bg-status-red/10 disabled:opacity-50"
          >
            Void
          </button>
        )}
      </div>

      {canSend && hasUnpricedLines && (
        // In place of the button, not as an error after clicking it.
        <p className="rounded-md border border-status-yellow/30 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow">
          This invoice has a line with no price. Set a cargo rate in
          company settings and regenerate before sending it.
        </p>
      )}

      {voiding && (
        <div className="rounded-md border border-border bg-background p-3">
          <label className="block text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Why is it being voided?
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. duplicate of INV-000004"
              className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground"
            />
          </label>
          <p className="mt-1.5 text-[0.65rem] text-muted-foreground">
            Kept with the invoice. A void with no stated reason is the one
            an auditor asks about.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void run("void", async () => {
                  const r = await voidInvoiceAction(invoiceId, reason);
                  if (r.status === "ok") setVoiding(false);
                  return r;
                })
              }
              disabled={pending !== null || reason.trim().length < 3}
              className="rounded-md bg-status-red px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              {pending === "void" ? "Voiding…" : "Confirm void"}
            </button>
            <button
              type="button"
              onClick={() => {
                setVoiding(false);
                setReason("");
              }}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <p role="status" className="text-xs text-status-green">
          {state.message}
        </p>
      )}
    </div>
  );
}
