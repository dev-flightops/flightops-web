"use client";

import { useState } from "react";

import { linkCaps } from "@/components/ff/controls";

import { portalInvoicePdfAction } from "./actions";

/**
 * Download one invoice's PDF (#129): fetched through a server action, then
 * saved from a Blob, as staff invoicing does. The bytes are decoded here
 * because a Buffer doesn't survive the server-action boundary.
 */
export function InvoiceDownload({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    const result = await portalInvoicePdfAction(invoiceId, invoiceNumber);
    setPending(false);
    if (result.status !== "ok") {
      setError(result.message);
      return;
    }
    const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Left unrevoked, every download leaks the file until the tab closes.
    URL.revokeObjectURL(url);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void download()}
        disabled={pending}
        aria-label={`Download ${invoiceNumber} as a PDF`}
        className={`${linkCaps} whitespace-nowrap disabled:opacity-60`}
      >
        {pending ? (
          "Preparing…"
        ) : (
          <>
            PDF <span aria-hidden>›</span>
          </>
        )}
      </button>
      {error ? (
        <span role="alert" className="field-error max-w-[16rem] whitespace-normal text-right">
          {error}
        </span>
      ) : null}
    </span>
  );
}
