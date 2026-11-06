"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";
import type { Part } from "@/lib/api/maintenance";
import { dayLabel, formatQty } from "@/lib/maintenance/parts";

import { lookupPartAction, movePartAction } from "./actions";

/**
 * Legacy's Barcode Scan panel (#172). A scanner types the code and presses
 * Enter, so the box does what a keyboard would. A part number with several
 * batches shows each one, soonest to expire first, and the mechanic checks out
 * the one in their hand; legacy took whichever batch came first.
 */
export function BarcodeScan() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [parts, setParts] = useState<Part[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function lookup() {
    setMessage(null);
    startTransition(async () => {
      const result = await lookupPartAction(code);
      if (!result.ok) {
        setParts(null);
        setMessage({ ok: false, text: result.message });
        return;
      }
      setParts(result.parts);
      if (result.parts.length === 0) setMessage({ ok: false, text: `Part ${code.trim()} not found.` });
    });
  }

  function move(part: Part, direction: "issued" | "received") {
    setMessage(null);
    startTransition(async () => {
      const result = await movePartAction({
        partId: part.id,
        txn_type: direction,
        quantity: "1",
        reference: direction === "issued" ? "Barcode scan: check out" : "Barcode scan: check in",
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.message });
        return;
      }
      const now = result.qty ?? part.qty_on_hand;
      setMessage({
        ok: true,
        text: `${direction === "issued" ? "Checked out" : "Checked in"} 1 × ${part.part_number}. New qty: ${formatQty(now)}.`,
      });
      setParts((rows) => rows?.map((p) => (p.id === part.id ? { ...p, qty_on_hand: now } : p)) ?? null);
      setCode("");
      input.current?.focus();
      router.refresh();
    });
  }

  return (
    <div className="mb-5">
      <button
        type="button"
        className={buttonOutline}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setMessage(null);
        }}
      >
        Barcode Scan
      </button>
      {open ? (
        <section aria-label="Barcode scan" className="mt-3 rounded-lg border border-border bg-card p-4">
          <form
            method="post"
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lookup();
            }}
          >
            <label htmlFor="scan-code" className="sr-only">
              Barcode or part number
            </label>
            <input
              id="scan-code"
              ref={input}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Scan barcode or type part number"
              className="ff-input min-w-[220px] flex-1 px-3 py-2 text-sm"
            />
            <button type="submit" className={buttonSolid} disabled={pending}>
              Lookup
            </button>
            {pending ? <Spinner size="xs" /> : null}
          </form>
          {message ? (
            <p role={message.ok ? "status" : "alert"} className={message.ok ? "mt-3 text-sm text-status-green" : "mt-3 text-sm text-status-red"}>
              {message.text}
            </p>
          ) : null}
          {parts && parts.length > 0 ? (
            <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
              {parts.map((part) => (
                <li key={part.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-mono font-semibold">{part.part_number}</span> {part.description}
                    <span className="block text-xs text-muted-foreground">
                      Qty {formatQty(part.qty_on_hand)} {part.unit} · {part.location ?? "No location"}
                      {part.batch_number ? ` · Batch ${part.batch_number}` : ""}
                      {part.lot_number ? ` · Lot ${part.lot_number}` : ""}
                      {part.expiration_date
                        ? ` · ${part.expired ? "Expired" : "Expires"} ${dayLabel(part.expiration_date)}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button type="button" className={buttonOutline} disabled={pending} onClick={() => move(part, "issued")}>
                      Check Out (1)
                    </button>
                    <button type="button" className={buttonOutline} disabled={pending} onClick={() => move(part, "received")}>
                      Check In (1)
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
