"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { Panel } from "@/components/ff/panel";
import { Spinner } from "@/components/ui/spinner";
import type {
  CheckInConfig,
  CheckInCustomField,
  CheckInFieldType,
} from "@/lib/api/check-in";

import {
  addCheckInFieldAction,
  saveCheckInRulesAction,
  setCheckInFieldAction,
  type SettingsResult,
} from "./actions";

const REQUIREMENTS: { key: keyof CheckInConfig; label: string }[] = [
  { key: "require_actual_weight", label: "Actual weight" },
  { key: "require_actual_bag_weight", label: "Actual bag weight" },
  { key: "require_bags_count", label: "Bag count" },
  { key: "require_id_verification", label: "Government ID verified" },
  { key: "require_hazmat_declaration", label: "Hazmat declaration" },
  { key: "require_seat_assignment", label: "Seat" },
];

const POLICY: { key: keyof CheckInConfig; label: string; hint: string }[] = [
  { key: "standby_enabled", label: "Standby", hint: "Standby passengers can be promoted to a seat at the gate." },
  { key: "allow_walk_up", label: "Walk-ups", hint: "Agents can add a passenger at the gate." },
  {
    key: "lock_manifest_on_close",
    label: "Lock the manifest when boarding closes",
    hint: "Final for weight and balance and the reports; it can't be unlocked.",
  },
];

const INPUT = "ff-input px-3 py-2 text-sm";

export function CheckInSettings({
  config,
  fields,
  canEdit,
}: {
  config: CheckInConfig;
  fields: CheckInCustomField[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rules, setRules] = useState(config);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<SettingsResult>, done: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      setMessage(result.ok ? { ok: true, text: done } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  function toggle(key: keyof CheckInConfig) {
    setRules((now) => ({ ...now, [key]: !now[key] }));
  }

  function saveRules(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { id: _id, ...patch } = rules;
    run(() => saveCheckInRulesAction(patch), "Saved.");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveRules} className="space-y-6">
        <Panel title="What Check-in Requires">
          <fieldset disabled={!canEdit} className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">What check-in requires</legend>
            {REQUIREMENTS.map((r) => (
              <label key={r.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(rules[r.key])} onChange={() => toggle(r.key)} />
                {r.label}
              </label>
            ))}
          </fieldset>
        </Panel>

        <Panel title="No-shows, Standby and Boarding">
          <fieldset disabled={!canEdit} className="space-y-3">
            <legend className="sr-only">No-shows, standby and boarding</legend>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rules.no_show_fee_enabled}
                  onChange={() => toggle("no_show_fee_enabled")}
                />
                Charge a no-show fee
              </label>
              {rules.no_show_fee_enabled ? (
                <span className="flex items-center gap-1 text-sm">
                  <span aria-hidden>$</span>
                  <input
                    aria-label="No-show fee in dollars"
                    type="number"
                    min={0}
                    step="0.01"
                    value={rules.no_show_fee_amount ?? ""}
                    onChange={(e) =>
                      setRules((now) => ({
                        ...now,
                        no_show_fee_amount: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className={`${INPUT} w-28`}
                  />
                </span>
              ) : null}
            </div>
            {POLICY.map((p) => (
              <label key={p.key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(rules[p.key])}
                  onChange={() => toggle(p.key)}
                />
                <span>
                  {p.label}
                  <span className="block text-xs text-muted-foreground">{p.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Panel>

        {canEdit ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="submit" className={buttonSolid} disabled={pending}>
              {pending ? <Spinner size="xs" /> : null}
              Save Check-in Settings
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            The Chief Pilot, the Director of Operations or an Exec Admin can change these.
          </p>
        )}
      </form>

      {message ? (
        <Notice tone={message.ok ? "green" : "red"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </Notice>
      ) : null}

      <Panel title="Your Own Fields">
        <p className="mb-3 text-sm text-muted-foreground">
          Asked at check-in after the standard questions, in this order. A field that&rsquo;s turned off
          keeps what was recorded with it.
        </p>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fields of your own yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th scope="col" className="px-3 py-2.5">Field</th>
                  <th scope="col" className="px-3 py-2.5">Key</th>
                  <th scope="col" className="px-3 py-2.5">Type</th>
                  <th scope="col" className="px-3 py-2.5">Required</th>
                  <th scope="col" className="px-3 py-2.5">In Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((f) => (
                  <tr key={f.id} className={f.is_active ? undefined : "opacity-60"}>
                    <td className="px-3 py-2.5">
                      {f.field_label}
                      {f.field_type === "dropdown" && f.field_options ? (
                        <span className="block text-xs text-muted-foreground">
                          {f.field_options.split("\n").filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{f.field_key}</td>
                    <td className="px-3 py-2.5 text-xs capitalize">{f.field_type}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`${f.field_label} required`}
                        checked={f.is_required}
                        disabled={!canEdit || pending}
                        onChange={() =>
                          run(() => setCheckInFieldAction(f.id, { is_required: !f.is_required }), "Saved.")
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`${f.field_label} in use`}
                        checked={f.is_active}
                        disabled={!canEdit || pending}
                        onChange={() =>
                          run(() => setCheckInFieldAction(f.id, { is_active: !f.is_active }), "Saved.")
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit ? <NewField pending={pending} onAdd={(input) => run(() => addCheckInFieldAction(input), "Field added.")} nextOrder={fields.length + 1} /> : null}
      </Panel>
    </div>
  );
}

function NewField({
  pending,
  nextOrder,
  onAdd,
}: {
  pending: boolean;
  nextOrder: number;
  onAdd: (input: {
    field_key: string;
    field_label: string;
    field_type: CheckInFieldType;
    field_options: string | null;
    is_required: boolean;
    sort_order: number;
    help_text: string | null;
  }) => void;
}) {
  const [type, setType] = useState<CheckInFieldType>("text");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onAdd({
      field_key: String(form.get("field_key") ?? "").trim(),
      field_label: String(form.get("field_label") ?? "").trim(),
      field_type: type,
      field_options: type === "dropdown" ? String(form.get("field_options") ?? "").trim() || null : null,
      is_required: form.get("is_required") === "yes",
      sort_order: nextOrder,
      help_text: String(form.get("help_text") ?? "").trim() || null,
    });
    e.currentTarget.reset();
    setType("text");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 border-t border-border pt-4">
      <p className="eyebrow">Add a Field</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="field-label">Label</span>
          <input name="field_label" required maxLength={200} placeholder="Home village" className={INPUT} />
        </label>
        <label className="block">
          <span className="field-label">Key</span>
          <input
            name="field_key"
            required
            maxLength={50}
            pattern="[A-Za-z0-9_\-]+"
            placeholder="home_village"
            className={`${INPUT} font-mono`}
          />
        </label>
        <label className="block">
          <span className="field-label">Type</span>
          <select
            name="field_type"
            value={type}
            onChange={(e) => setType(e.target.value as CheckInFieldType)}
            className={INPUT}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="checkbox">Checkbox</option>
            <option value="dropdown">Dropdown</option>
          </select>
        </label>
      </div>
      {type === "dropdown" ? (
        <label className="block">
          <span className="field-label">Options, one per line</span>
          <textarea name="field_options" rows={3} required className={INPUT} />
        </label>
      ) : null}
      <label className="block">
        <span className="field-label">Help Text</span>
        <input name="help_text" maxLength={200} className={INPUT} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_required" value="yes" />
          Required
        </label>
        <button type="submit" className={buttonOutline} disabled={pending}>
          Add Field
        </button>
      </div>
    </form>
  );
}
