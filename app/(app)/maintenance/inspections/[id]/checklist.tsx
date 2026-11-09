"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { Spinner } from "@/components/ui/spinner";
import type { InspectionItem, InspectionItemState } from "@/lib/api/inspections";

import { addItemAction, failItemAction, passItemAction, removeItemAction } from "../actions";

const STATE: Record<InspectionItemState, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "gray" },
  pass: { label: "Pass", tone: "green" },
  fail: { label: "Fail", tone: "red" },
  corrected: { label: "Corrected", tone: "teal" },
};

/**
 * The checklist by section (#178), legacy's inspection_detail.html. A pending
 * item passes or fails; failing says what was found and opens a squawk on the
 * aircraft with it, and the item reads corrected once that squawk is resolved.
 * An unchecked item can come off; a checked one stays on the record.
 */
export function Checklist({
  inspectionId,
  aircraftId,
  items,
  canEdit,
}: {
  inspectionId: string;
  aircraftId: string;
  items: InspectionItem[];
  /** Still being worked, and the viewer is shop staff. */
  canEdit: boolean;
}) {
  const sections = new Map<string, InspectionItem[]>();
  for (const item of items) sections.set(item.section, [...(sections.get(item.section) ?? []), item]);

  return (
    <section aria-label="Checklist" className="space-y-5">
      {sections.size === 0 ? (
        <p className="text-sm text-muted-foreground">No checklist items yet. Add them below to begin tracking.</p>
      ) : (
        [...sections.entries()].map(([section, sectionItems]) => (
          <div key={section}>
            <h2 className="section-title mb-2">{section}</h2>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="ff-table w-full text-sm">
                <thead className="ff-thead">
                  <tr>
                    <th className="w-12">#</th>
                    <th>Item</th>
                    <th className="w-28">Status</th>
                    {canEdit ? <th className="w-52 text-right">Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sectionItems.map((item, index) => (
                    <ItemRow
                      key={item.id}
                      inspectionId={inspectionId}
                      aircraftId={aircraftId}
                      item={item}
                      number={item.item_number ?? String(index + 1)}
                      canEdit={canEdit}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      {canEdit ? <AddItem inspectionId={inspectionId} /> : null}
    </section>
  );
}

function ItemRow({
  inspectionId,
  aircraftId,
  item,
  number,
  canEdit,
}: {
  inspectionId: string;
  aircraftId: string;
  item: InspectionItem;
  number: string;
  canEdit: boolean;
}) {
  const [failing, setFailing] = useState(false);
  const [finding, setFinding] = useState("");
  const [severity, setSeverity] = useState("major");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const state = STATE[item.state];

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) after?.();
      else setError(result.message);
    });
  }

  return (
    <Fragment>
      <tr className={item.state === "fail" ? "border-l-[3px] border-l-status-red" : undefined}>
        <td className="font-mono text-xs text-muted-foreground">{number}</td>
        <td>
          <span className={item.state === "pass" || item.state === "corrected" ? "text-muted-foreground" : undefined}>
            {item.description}
          </span>
          {item.finding ? <span className="mt-0.5 block text-xs text-foreground">Found: {item.finding}</span> : null}
          {item.squawk_id ? (
            <Link href={`/maintenance/squawks?aircraft=${aircraftId}`} className={`${linkCaps} mt-0.5 inline-block`}>
              Squawk · {item.squawk_status === "resolved" ? "resolved" : (item.squawk_severity ?? "open")}{" "}
              <span aria-hidden>›</span>
            </Link>
          ) : null}
          {item.marked_by_name ? (
            <span className="mt-0.5 block text-[0.7rem] text-muted-foreground">{item.marked_by_name}</span>
          ) : null}
          {error ? (
            <span role="alert" className="field-error block">
              {error}
            </span>
          ) : null}
        </td>
        <td>
          <StatusMark label={state.label} tone={state.tone} />
        </td>
        {canEdit ? (
          <td className="text-right">
            {item.state === "pending" && !failing ? (
              <span className="inline-flex flex-wrap justify-end gap-1.5">
                {pending ? <Spinner size="xs" /> : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => passItemAction(inspectionId, item.id))}
                  className={buttonOutline}
                  aria-label={`Pass: ${item.description}`}
                >
                  Pass
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setFailing(true)}
                  className={`${buttonOutline} text-status-red`}
                  aria-label={`Fail: ${item.description}`}
                >
                  Fail
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Take "${item.description}" off the checklist?`)) {
                      run(() => removeItemAction(inspectionId, item.id));
                    }
                  }}
                  className="px-1 text-xs text-muted-foreground hover:text-foreground"
                  aria-label={`Remove: ${item.description}`}
                >
                  Remove
                </button>
              </span>
            ) : null}
          </td>
        ) : null}
      </tr>
      {failing ? (
        <tr>
          <td />
          <td colSpan={3}>
            <form
              className="space-y-2 pb-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => failItemAction(inspectionId, item.id, { finding, severity }), () => setFailing(false));
              }}
            >
              <label htmlFor={`finding-${item.id}`} className="field-label">
                What was found<span className="text-status-red"> *</span>
              </label>
              <textarea
                id={`finding-${item.id}`}
                rows={2}
                maxLength={4000}
                value={finding}
                onChange={(e) => setFinding(e.target.value)}
                className="ff-input px-3 py-2 text-sm"
                placeholder="It becomes the squawk on the aircraft"
              />
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor={`severity-${item.id}`} className="field-label">
                    Squawk Severity
                  </label>
                  <select
                    id={`severity-${item.id}`}
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="ff-input px-3 py-2 text-sm"
                  >
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="grounding">Grounding</option>
                  </select>
                </div>
                <button type="submit" disabled={pending} className={buttonSolid}>
                  Fail &amp; Open Squawk
                </button>
                <button type="button" disabled={pending} onClick={() => setFailing(false)} className={buttonOutline}>
                  Cancel
                </button>
              </div>
            </form>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function AddItem({ inspectionId }: { inspectionId: string }) {
  const [section, setSection] = useState("General");
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      aria-label="Add a checklist item"
      className="rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await addItemAction(inspectionId, { section, item_number: number, description });
          if (result.ok) {
            setDescription("");
            setNumber("");
          } else setError(result.message);
        });
      }}
    >
      <h2 className="section-title mb-3">Add Checklist Item</h2>
      {error ? (
        <p role="alert" className="notice notice-red mb-3">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[10rem_5rem_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="item-section" className="field-label">
            Section
          </label>
          <input
            id="item-section"
            value={section}
            maxLength={100}
            onChange={(e) => setSection(e.target.value)}
            placeholder="Airframe"
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="item-number" className="field-label">
            #
          </label>
          <input
            id="item-number"
            value={number}
            maxLength={20}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="1"
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="item-description" className="field-label">
            Description<span className="text-status-red"> *</span>
          </label>
          <input
            id="item-description"
            value={description}
            maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Check condition of…"
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" disabled={pending} className={buttonSolid}>
          Add
        </button>
      </div>
    </form>
  );
}
