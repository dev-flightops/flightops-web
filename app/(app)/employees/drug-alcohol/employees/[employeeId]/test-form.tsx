"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { Collector, FaaCategory, Panel, TestRecord } from "@/lib/api/drug-alcohol";
import {
  ALCOHOL_OUTCOMES,
  ALCOHOL_REFUSALS,
  DRUG_CLASSES,
  DRUG_REFUSALS,
  DRUG_RESULTS,
  FAA_CATEGORIES,
  TEST_TYPES,
} from "@/lib/drug-alcohol/options";
import { localDay, localToUtcIso, utcToLocalInput, zoneAbbreviation } from "@/lib/format/local-time";

import { logTestAction, updateTestAction, type TestFormValues } from "../../actions";

/**
 * A test, entered or corrected: legacy's Log New Test Record, with what the
 * DOT MIS form needs from each result. A positive names the drugs found, a
 * refusal its reason, an alcohol test its screening and confirmation
 * levels (the service works the result out from them). Left without a
 * result, the test waits on the lab or the MRO.
 */

function valuesOf(test: TestRecord | undefined, panel: Panel, category: FaaCategory | null, zone: string): TestFormValues {
  if (!test) {
    return {
      test_type: "",
      panel,
      test_date: localDay(zone),
      collected_at: "",
      category: category ?? "",
      result: "",
      drugs: [],
      refusal_reason: "",
      screening_level: "",
      confirmation_level: "",
      collection_site_id: "",
      mro_id: "",
      lab_id: "",
      specimen_id: "",
      split_requested: false,
      notes: "",
    };
  }
  const alcoholDone = test.panel === "alcohol" && ["negative", "alcohol_02", "alcohol_04"].includes(test.result ?? "");
  return {
    test_type: test.test_type,
    panel: test.panel,
    test_date: test.test_date,
    collected_at: test.collected_at ? utcToLocalInput(test.collected_at, zone) : "",
    category: test.category,
    result: alcoholDone ? "completed" : (test.result ?? ""),
    drugs: test.drugs,
    refusal_reason: test.refusal_reason ?? "",
    screening_level: test.screening_level?.toFixed(3) ?? "",
    confirmation_level: test.confirmation_level?.toFixed(3) ?? "",
    collection_site_id: test.collection_site?.id ?? "",
    mro_id: test.mro?.id ?? "",
    lab_id: test.lab?.id ?? "",
    specimen_id: test.specimen_id ?? "",
    split_requested: test.split_requested,
    notes: test.notes ?? "",
  };
}

export function TestForm({
  userId,
  zone,
  collectors,
  category,
  test,
  selectionEntryId,
  panel = "drug",
}: {
  userId: string;
  zone: string;
  collectors: Collector[];
  /** The person's FAA category, picked to start with. */
  category: FaaCategory | null;
  /** The test being corrected; none to enter a new one. */
  test?: TestRecord;
  /** The random selection this test answers. */
  selectionEntryId?: string | null;
  panel?: Panel;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TestFormValues>(() =>
    valuesOf(test, panel, category, zone),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const answersSelection = Boolean(selectionEntryId) || Boolean(test?.selection_entry_id);
  const editing = Boolean(test);
  const set = (name: keyof TestFormValues) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [name]: e.target.value }));
  const drug = values.panel === "drug";
  const positive = drug && (values.result === "positive" || values.result === "positive_dilute");
  const screening = Number.parseFloat(values.screening_level);
  const needsConfirmation = !drug && values.result === "completed" && Number.isFinite(screening) && screening >= 0.02;
  const of = (kind: Collector["kind"], current: string) =>
    collectors.filter((c) => c.kind === kind && (c.is_active || c.id === current));

  return (
    <form
      method="post"
      aria-label={editing ? "Correct the test" : "Enter a test"}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const collected = values.collected_at ? localToUtcIso(values.collected_at, zone) : "";
        if (collected === null) {
          setMessage("Enter the collection time as a date and time.");
          return;
        }
        const outbound = {
          ...values,
          collected_at: collected,
          test_type: answersSelection ? "random" : values.test_type,
          // A result's details belong to its result.
          drugs: positive ? values.drugs : [],
          refusal_reason: values.result === "refusal" ? values.refusal_reason : "",
          screening_level: !drug && values.result === "completed" ? values.screening_level : "",
          confirmation_level: needsConfirmation ? values.confirmation_level : "",
        };
        startTransition(async () => {
          setMessage(null);
          const result = test
            ? await updateTestAction(userId, test.id, outbound)
            : await logTestAction(userId, outbound, selectionEntryId ?? null);
          if (result.ok) router.push(`/employees/drug-alcohol/employees/${userId}`);
          else setMessage(result.message);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="test-panel" className="field-label">
            Panel<span className="text-status-red"> *</span>
          </label>
          <select
            id="test-panel"
            value={values.panel}
            disabled={editing || answersSelection}
            onChange={(e) => setValues((v) => ({ ...v, panel: e.target.value, result: "" }))}
            className="ff-input w-full px-3 py-2 text-sm"
          >
            <option value="drug">Drug</option>
            <option value="alcohol">Alcohol</option>
          </select>
        </div>
        <div>
          <label htmlFor="test-type" className="field-label">
            Type of Test<span className="text-status-red"> *</span>
          </label>
          <select
            id="test-type"
            value={answersSelection ? "random" : values.test_type}
            disabled={answersSelection}
            onChange={set("test_type")}
            className="ff-input w-full px-3 py-2 text-sm"
          >
            <option value="">Pick the type</option>
            {TEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {answersSelection ? <p className="mt-1 text-xs text-muted-foreground">It answers a random selection.</p> : null}
        </div>
        <div>
          <label htmlFor="test-category" className="field-label">
            FAA Category<span className="text-status-red"> *</span>
          </label>
          <select id="test-category" value={values.category} onChange={set("category")} className="ff-input w-full px-3 py-2 text-sm">
            <option value="">Pick the category</option>
            {FAA_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="test-date" className="field-label">
            Test Date<span className="text-status-red"> *</span>
          </label>
          <input id="test-date" type="date" value={values.test_date} onChange={set("test_date")} className="ff-input w-full px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="test-collected" className="field-label">
            Collected At ({zoneAbbreviation(zone)})
          </label>
          <input
            id="test-collected"
            type="datetime-local"
            value={values.collected_at}
            onChange={set("collected_at")}
            className="ff-input w-full px-3 py-2 text-sm"
          />
          {!drug ? (
            <p className="mt-1 text-xs text-muted-foreground">From the breath test&rsquo;s printout. A result of 0.02 or more needs it.</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="test-result" className="field-label">
            Result
          </label>
          <select id="test-result" value={values.result} onChange={set("result")} className="ff-input w-full px-3 py-2 text-sm">
            <option value="">Waiting on the result</option>
            {(drug ? DRUG_RESULTS : ALCOHOL_OUTCOMES).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {positive ? (
        <fieldset>
          <legend className="field-label">
            Drugs Found<span className="text-status-red"> *</span>
          </legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {DRUG_CLASSES.map((d) => (
              <label key={d.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.drugs.includes(d.value)}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      drugs: e.target.checked ? [...v.drugs, d.value] : v.drugs.filter((x) => x !== d.value),
                    }))
                  }
                />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {values.result === "refusal" ? (
        <div className="max-w-sm">
          <label htmlFor="test-refusal" className="field-label">
            Refusal<span className="text-status-red"> *</span>
          </label>
          <select id="test-refusal" value={values.refusal_reason} onChange={set("refusal_reason")} className="ff-input w-full px-3 py-2 text-sm">
            <option value="">Pick the reason</option>
            {(drug ? DRUG_REFUSALS : ALCOHOL_REFUSALS).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!drug && values.result === "completed" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="test-screening" className="field-label">
              Screening Level<span className="text-status-red"> *</span>
            </label>
            <input
              id="test-screening"
              inputMode="decimal"
              value={values.screening_level}
              onChange={set("screening_level")}
              placeholder="0.000"
              className="ff-input w-full px-3 py-2 text-sm"
            />
          </div>
          {needsConfirmation ? (
            <div>
              <label htmlFor="test-confirmation" className="field-label">
                Confirmation Level<span className="text-status-red"> *</span>
              </label>
              <input
                id="test-confirmation"
                inputMode="decimal"
                value={values.confirmation_level}
                onChange={set("confirmation_level")}
                placeholder="0.000"
                className="ff-input w-full px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">0.02 to 0.039 takes them off duty; 0.04 or more is a violation.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["collection_site_id", "collection_site", "Collection Site"],
            ["mro_id", "mro", "MRO"],
            ["lab_id", "lab", "Laboratory"],
          ] as const
        ).map(([field, kind, label]) => (
          <div key={field}>
            <label htmlFor={`test-${field}`} className="field-label">
              {label}
            </label>
            <select id={`test-${field}`} value={values[field]} onChange={set(field)} className="ff-input w-full px-3 py-2 text-sm">
              <option value="">None</option>
              {of(kind, values[field]).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div>
          <label htmlFor="test-specimen" className="field-label">
            Specimen / CCF Number
          </label>
          <input id="test-specimen" value={values.specimen_id} onChange={set("specimen_id")} maxLength={60} className="ff-input w-full px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={values.split_requested}
            onChange={(e) => setValues((v) => ({ ...v, split_requested: e.target.checked }))}
          />
          Split specimen requested
        </label>
        <div className="sm:col-span-3">
          <label htmlFor="test-notes" className="field-label">
            Notes
          </label>
          <textarea id="test-notes" rows={2} value={values.notes} onChange={set("notes")} maxLength={4000} className="ff-input w-full px-3 py-2 text-sm" />
        </div>
      </div>

      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonOutline} onClick={() => router.push(`/employees/drug-alcohol/employees/${userId}`)} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Saving…" : editing ? "Save the Test" : "Enter the Test"}
        </button>
      </div>
    </form>
  );
}
