"use client";

import { useActionState, useEffect, useState } from "react";

import { MAIL_CLASSES, MAIL_CLASS_LABELS, type ManifestCargoRow } from "@/lib/api/manifest";

import { saveFreightAction, type ManifestFormState } from "./actions";
import { FIELD, Flag, fmtLbs, FormNotice, MailBadge, TH, THEAD } from "./manifest-bits";
import { RemoveLine } from "./remove-line";

const _initial: ManifestFormState = { status: "idle", attempt: 0 };

type Kind = "mail" | "cargo";

const _TITLE: Record<Kind, string> = { mail: "USPS Mail", cargo: "Cargo & Freight" };
const _ADD: Record<Kind, string> = { mail: "+ Add Mail", cargo: "+ Add Cargo" };
const _EMPTY: Record<Kind, string> = {
  mail: "No mail on this manifest.",
  cargo: "No cargo on this manifest.",
};

/**
 * Legacy's "USPS Mail" and "Cargo & Freight" blocks. Both are cargo lines
 * in FlightOps, a mail line being one with a mail class. Legacy's UPS
 * packages are cargo lines too, with their tracking number: FlightOps
 * keeps no separate UPS log (#62).
 */
export function FreightSection({
  flightId,
  kind,
  rows,
  editable,
}: {
  flightId: string;
  kind: Kind;
  rows: ManifestCargoRow[];
  editable: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const editing = open && open !== "add" ? (rows.find((c) => c.id === open) ?? null) : null;
  const formOpen = editable && (open === "add" || editing !== null);
  const pounds = rows.reduce((sum, c) => sum + Number(c.weight_lbs), 0);

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{_TITLE[kind]}</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length} item{rows.length === 1 ? "" : "s"} · {fmtLbs(pounds)} lb
        </span>
        {editable ? (
          <button
            type="button"
            onClick={() => setOpen(open === "add" ? null : "add")}
            className="ml-auto rounded-md border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground/80 hover:bg-accent"
          >
            {_ADD[kind]}
          </button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">{_EMPTY[kind]}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={THEAD}>
                {kind === "mail" ? (
                  <tr>
                    <th className={TH}>Class</th>
                    <th className={TH}>Description</th>
                    <th className={`${TH} text-right`}>Weight</th>
                    <th className={`${TH} text-right`}>Pieces</th>
                    <th className={TH}>Notes</th>
                    {editable ? <th className={`${TH} text-right`}>Actions</th> : null}
                  </tr>
                ) : (
                  <tr>
                    <th className={TH}>Description</th>
                    <th className={`${TH} text-right`}>Weight</th>
                    <th className={`${TH} text-right`}>Pieces</th>
                    <th className={TH}>HazMat</th>
                    <th className={TH}>Shipper → Consignee</th>
                    <th className={TH}>Tracking</th>
                    {editable ? <th className={`${TH} text-right`}>Actions</th> : null}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-accent">
                    {kind === "mail" ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {c.mail_class ? <MailBadge mailClass={c.mail_class} /> : "—"}
                        </td>
                        <td className="px-3 py-2.5">{c.description}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{fmtLbs(c.weight_lbs)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{c.pieces}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.notes ?? "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{c.description}</div>
                          {c.notes ? <div className="mt-0.5 text-xs text-muted-foreground">{c.notes}</div> : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{fmtLbs(c.weight_lbs)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{c.pieces}</td>
                        <td className="px-3 py-2.5">
                          {c.is_hazmat ? (
                            <div className="flex flex-col items-start gap-0.5">
                              <Flag label="HAZMAT" tone="red" />
                              {c.hazmat_notes ? <span className="text-xs text-status-red">{c.hazmat_notes}</span> : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                          {c.shipper || c.consignee ? `${c.shipper ?? "—"} → ${c.consignee ?? "—"}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          {c.tracking_number ?? "—"}
                        </td>
                      </>
                    )}
                    {editable ? (
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setOpen(c.id)}
                            className="text-xs font-semibold text-foreground/80 hover:text-foreground hover:underline"
                          >
                            Edit
                          </button>
                          <RemoveLine flightId={flightId} kind="cargo" lineId={c.id} label={c.description} />
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {formOpen ? (
        <FreightForm key={open} flightId={flightId} kind={kind} line={editing} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}

function FreightForm({
  flightId,
  kind,
  line,
  onClose,
}: {
  flightId: string;
  kind: Kind;
  line: ManifestCargoRow | null;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveFreightAction, _initial);
  const sent = state.status === "error" ? state.values : undefined;
  const value = (key: string, saved: string | null | undefined) => sent?.[key] ?? saved ?? "";
  const done = state.status === "ok" && line !== null;
  useEffect(() => {
    if (done) onClose();
  }, [done, onClose]);
  const heading = line ? `Edit ${kind === "mail" ? "Mail" : line.description}` : kind === "mail" ? "Add Mail" : "Add Cargo";

  return (
    <form
      key={state.attempt}
      action={formAction}
      aria-label={heading}
      className="mt-3 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <input type="hidden" name="flight_id" value={flightId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="cargo_id" value={line?.id ?? ""} />
      <h3 className="col-span-full text-sm font-semibold">{heading}</h3>
      <FormNotice status={state.status} message={state.message} />

      {kind === "mail" ? (
        <>
          <input type="hidden" name="current_description" value={line?.description ?? ""} />
          <input type="hidden" name="current_mail_class" value={line?.mail_class ?? ""} />
          <label className="grid gap-1 text-xs">
            Mail Class *
            <select name="mail_class" defaultValue={value("mail_class", line?.mail_class ?? "bypass_mail")} className={FIELD}>
              {MAIL_CLASSES.map((m) => (
                <option key={m} value={m}>
                  {MAIL_CLASS_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className="grid gap-1 text-xs sm:col-span-2">
          Description *
          <input
            name="description"
            required
            maxLength={200}
            placeholder="Groceries, equipment, UPS package…"
            defaultValue={value("description", line?.description)}
            className={FIELD}
          />
        </label>
      )}
      <label className="grid gap-1 text-xs">
        Weight (lbs) *
        <input
          name="weight_lbs"
          type="number"
          required
          min={0}
          step="any"
          defaultValue={value("weight_lbs", line ? String(Number(line.weight_lbs)) : "")}
          className={FIELD}
        />
      </label>
      <label className="grid gap-1 text-xs">
        Pieces
        <input
          name="pieces"
          type="number"
          min={1}
          step={1}
          defaultValue={value("pieces", line ? String(line.pieces) : "1")}
          className={FIELD}
        />
      </label>
      {kind === "cargo" ? (
        <>
          <label className="grid gap-1 text-xs">
            Tracking / Waybill
            <input name="tracking_number" maxLength={80} defaultValue={value("tracking_number", line?.tracking_number)} className={`${FIELD} font-mono`} />
          </label>
          <label className="grid gap-1 text-xs">
            Shipper
            <input name="shipper" maxLength={120} defaultValue={value("shipper", line?.shipper)} className={FIELD} />
          </label>
          <label className="grid gap-1 text-xs">
            Consignee
            <input name="consignee" maxLength={120} defaultValue={value("consignee", line?.consignee)} className={FIELD} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="is_hazmat"
              defaultChecked={sent ? sent.is_hazmat === "on" : (line?.is_hazmat ?? false)}
              className="accent-primary"
            />
            Hazardous materials
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            HazMat Class / Notes
            <input
              name="hazmat_notes"
              maxLength={2000}
              placeholder="Class 3, ORM-D… (kept only when hazardous is ticked)"
              defaultValue={value("hazmat_notes", line?.hazmat_notes)}
              className={FIELD}
            />
          </label>
        </>
      ) : null}
      <label className="col-span-full grid gap-1 text-xs">
        Notes
        <input
          name="notes"
          maxLength={2000}
          placeholder={kind === "mail" ? "Pouch #, remarks…" : "Remarks"}
          defaultValue={value("notes", line?.notes)}
          className={FIELD}
        />
      </label>
      <div className="col-span-full flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
          {line ? "Cancel" : "Close"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : line ? "Save" : kind === "mail" ? "Add Mail" : "Add Cargo"}
        </button>
      </div>
    </form>
  );
}
