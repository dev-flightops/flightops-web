"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  actOnEntry,
  certifyMis,
  createCollector,
  createSelection,
  createTest,
  returnToDuty,
  saveProgram,
  savePerson,
  updateCollector,
  updateTest,
  uploadTestFile,
  type CollectorKind,
  type FaaCategory,
  type Panel,
  type SelectionPanel,
  type TestInput,
  type TestType,
} from "@/lib/api/drug-alcohol";
import { updateDrugAlcoholBlocks } from "@/lib/api/type-qualifications";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * The drug and alcohol program from the web. Directly callable, as
 * onboarding's, so each form's logic can be tested under jsdom; each
 * returns what happened for the page to say.
 */

export type DrugAlcoholResult = { ok: true; id?: string } | { ok: false; message: string };

const RUNS_IT = "The drug and alcohol program is run by its DER, the alternate DER and the Exec Admins.";

/** The service's own sentence, not a code such as "insufficient_role". */
function sentence(err: ApiError): string | null {
  try {
    const detail = (JSON.parse(err.message) as { detail?: unknown }).detail;
    return typeof detail === "string" && detail.includes(" ") ? detail : null;
  } catch {
    return null;
  }
}

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) return sentence(err) ?? RUNS_IT;
    if (err.status === 413) return "That file is too large — the limit is 25 MB.";
    if (err.status === 415) return "That kind of file isn't accepted: use a PDF, an image or a Word document.";
    const own = refusalText(err);
    if (err.status === 404) return own ?? "That isn't on file any more — refresh the page.";
    return own ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

function refresh(...paths: string[]) {
  revalidatePath("/employees/drug-alcohol");
  revalidatePath("/home");
  for (const p of paths) revalidatePath(p);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : null;
}

function id(value: unknown): string | null {
  const v = text(value);
  return v && UUID.test(v) ? v : null;
}

// ---- The program --------------------------------------------------------------

const ProgramSchema = z.object({
  drug_rate_pct: z.coerce
    .number({ invalid_type_error: "Enter the drug rate." })
    .min(25, "The FAA's minimum random drug rate is 25%.")
    .max(100, "A rate is at most 100%."),
  alcohol_rate_pct: z.coerce
    .number({ invalid_type_error: "Enter the alcohol rate." })
    .min(10, "The FAA's minimum random alcohol rate is 10%.")
    .max(100, "A rate is at most 100%."),
});

export async function saveProgramAction(raw: {
  der_user_id: string;
  alternate_der_user_id: string;
  der_phone: string;
  drug_rate_pct: string;
  alcohol_rate_pct: string;
  safety_sensitive_roles: string[];
  faa_certificate_number: string;
  plan_number: string;
  ctpa_name: string;
  ctpa_phone: string;
}): Promise<DrugAlcoholResult> {
  const rates = ProgramSchema.safeParse(raw);
  if (!rates.success) return { ok: false, message: rates.error.issues[0]?.message ?? "Check the rates." };
  const der = id(raw.der_user_id);
  const alternate = id(raw.alternate_der_user_id);
  if (alternate && alternate === der) return { ok: false, message: "The alternate DER is someone other than the DER." };
  try {
    await saveProgram({
      der_user_id: der,
      alternate_der_user_id: alternate,
      der_phone: text(raw.der_phone),
      drug_rate_pct: rates.data.drug_rate_pct,
      alcohol_rate_pct: rates.data.alcohol_rate_pct,
      safety_sensitive_roles: raw.safety_sensitive_roles,
      faa_certificate_number: text(raw.faa_certificate_number),
      plan_number: text(raw.plan_number),
      ctpa_name: text(raw.ctpa_name),
      ctpa_phone: text(raw.ctpa_phone),
    });
    refresh("/employees/drug-alcohol/program", "/employees/drug-alcohol/pool");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "save the program") };
  }
}

export async function setDrugAlcoholBlocksAction(blocks: boolean): Promise<DrugAlcoholResult> {
  try {
    await updateDrugAlcoholBlocks(blocks);
    refresh("/employees/drug-alcohol/program", "/settings/currency", "/dispatch");
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return { ok: false, message: "The Director of Operations or an Exec Admin can change this." };
    }
    return { ok: false, message: refusal(err, "change the release check") };
  }
}

// ---- The pool -------------------------------------------------------------------

export async function savePersonAction(
  userId: string,
  raw: { pool: string; pool_note: string; category: string },
): Promise<DrugAlcoholResult> {
  const pool = raw.pool === "in" || raw.pool === "out" ? raw.pool : "auto";
  const note = text(raw.pool_note);
  if (pool === "out" && !note) return { ok: false, message: "Say why they're left out of the pool, e.g. on leave." };
  try {
    await savePerson(userId, { pool, pool_note: note, category: (text(raw.category) as FaaCategory | null) ?? null });
    refresh("/employees/drug-alcohol/pool", `/employees/drug-alcohol/employees/${userId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "save that") };
  }
}

export async function createSelectionAction(raw: {
  panel: string;
  method: string;
  count: string;
  user_ids: string[];
  period_label: string;
  source: string;
  notes: string;
}): Promise<DrugAlcoholResult> {
  const panel = (["drug", "alcohol", "both"].includes(raw.panel) ? raw.panel : "") as SelectionPanel | "";
  if (!panel) return { ok: false, message: "Pick what they're tested for." };
  const method = raw.method === "entered" ? "entered" : "drawn";
  let count: number | undefined;
  if (method === "drawn") {
    count = Number.parseInt(raw.count, 10);
    if (!Number.isFinite(count) || count < 1) return { ok: false, message: "Say how many to draw." };
  } else {
    if (raw.user_ids.length === 0) return { ok: false, message: "Tick the people on the consortium's list." };
    if (!text(raw.source)) return { ok: false, message: "Say whose list it is, e.g. the consortium." };
  }
  try {
    const selection = await createSelection({
      panel,
      method,
      count,
      user_ids: method === "entered" ? raw.user_ids : undefined,
      period_label: text(raw.period_label),
      source: method === "entered" ? text(raw.source) : null,
      notes: text(raw.notes),
    });
    refresh("/employees/drug-alcohol/pool");
    return { ok: true, id: selection.id };
  } catch (err) {
    return { ok: false, message: refusal(err, "make the selection") };
  }
}

export async function entryAction(
  selectionId: string,
  entryId: string,
  action: "notify" | "excuse" | "reopen",
  reason?: string,
): Promise<DrugAlcoholResult> {
  if (action === "excuse" && !text(reason)) return { ok: false, message: "Say why they're excused." };
  try {
    await actOnEntry(entryId, { action, reason: text(reason) });
    refresh(`/employees/drug-alcohol/selections/${selectionId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "save that") };
  }
}

// ---- Tests ----------------------------------------------------------------------

export interface TestFormValues {
  test_type: string;
  panel: string;
  test_date: string;
  collected_at: string;
  category: string;
  result: string;
  drugs: string[];
  refusal_reason: string;
  screening_level: string;
  confirmation_level: string;
  collection_site_id: string;
  mro_id: string;
  lab_id: string;
  specimen_id: string;
  split_requested: boolean;
  notes: string;
}

const TEST_TYPES = ["pre_employment", "random", "post_accident", "reasonable_suspicion", "return_to_duty", "follow_up"];
const LEVEL = /^(0(\.\d{1,3})?|1(\.0{1,3})?|\.\d{1,3})$/;

/** The form's values as the service takes them, or why not. The service
 *  checks the result against the panel and says what's missing. */
function testInput(raw: TestFormValues): { input: TestInput } | { message: string } {
  if (!TEST_TYPES.includes(raw.test_type)) return { message: "Pick the type of test." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.test_date)) return { message: "Enter the test's date." };
  let collected: string | null = null;
  if (text(raw.collected_at)) {
    const at = new Date(raw.collected_at);
    if (Number.isNaN(at.getTime())) return { message: "Enter the collection time as a date and time." };
    collected = at.toISOString();
  }
  for (const [name, value] of [
    ["screening", raw.screening_level],
    ["confirmation", raw.confirmation_level],
  ] as const) {
    if (text(value) && !LEVEL.test(value.trim())) {
      return { message: `Enter the ${name} level as a breath alcohol concentration, e.g. 0.025.` };
    }
  }
  return {
    input: {
      test_type: raw.test_type as TestType,
      test_date: raw.test_date,
      collected_at: collected,
      category: (text(raw.category) as FaaCategory | null) ?? null,
      result: text(raw.result),
      drugs: raw.drugs,
      refusal_reason: text(raw.refusal_reason),
      screening_level: text(raw.screening_level),
      confirmation_level: text(raw.confirmation_level),
      collection_site_id: id(raw.collection_site_id),
      mro_id: id(raw.mro_id),
      lab_id: id(raw.lab_id),
      specimen_id: text(raw.specimen_id),
      split_requested: raw.split_requested,
      notes: text(raw.notes),
    },
  };
}

export async function logTestAction(
  userId: string,
  raw: TestFormValues,
  selectionEntryId: string | null,
): Promise<DrugAlcoholResult> {
  if (raw.panel !== "drug" && raw.panel !== "alcohol") return { ok: false, message: "Pick drug or alcohol." };
  const checked = testInput(raw);
  if ("message" in checked) return { ok: false, message: checked.message };
  try {
    const test = await createTest({
      ...checked.input,
      user_id: userId,
      panel: raw.panel as Panel,
      selection_entry_id: id(selectionEntryId),
    });
    refresh(`/employees/drug-alcohol/employees/${userId}`, "/employees/drug-alcohol/my-tests", `/employees/${userId}`);
    return { ok: true, id: test.id };
  } catch (err) {
    return { ok: false, message: refusal(err, "save the test") };
  }
}

export async function updateTestAction(userId: string, testId: string, raw: TestFormValues): Promise<DrugAlcoholResult> {
  const checked = testInput(raw);
  if ("message" in checked) return { ok: false, message: checked.message };
  if (!checked.input.category) return { ok: false, message: "Pick the FAA category." };
  try {
    await updateTest(testId, checked.input);
    refresh(`/employees/drug-alcohol/employees/${userId}`, "/employees/drug-alcohol/my-tests", `/employees/${userId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "save the test") };
  }
}

export async function returnToDutyAction(userId: string, testId: string): Promise<DrugAlcoholResult> {
  try {
    await returnToDuty(testId);
    refresh(`/employees/drug-alcohol/employees/${userId}`, `/employees/${userId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      try {
        const detail = (JSON.parse(err.message) as { detail?: { error?: string; hold_ends_at?: string } }).detail;
        if (detail?.error === "too_soon" && detail.hold_ends_at) {
          return {
            ok: false,
            message: `Not yet: 8 hours after the test is ${new Date(detail.hold_ends_at).toUTCString().slice(5, 22)}Z.`,
          };
        }
      } catch {
        // Fall through to the service's sentence.
      }
    }
    return { ok: false, message: refusal(err, "put them back on duty") };
  }
}

export async function uploadTestFileAction(userId: string, testId: string, form: FormData): Promise<DrugAlcoholResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file to upload." };
  const kind = String(form.get("kind") ?? "");
  const outbound = new FormData();
  outbound.append("kind", kind);
  outbound.append("file", file, file.name);
  try {
    await uploadTestFile(testId, outbound);
    refresh(`/employees/drug-alcohol/employees/${userId}`, "/employees/drug-alcohol/my-tests");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "upload the file") };
  }
}

// ---- Collectors -----------------------------------------------------------------

export async function saveCollectorAction(
  collectorId: string | null,
  raw: Record<string, string | boolean>,
): Promise<DrugAlcoholResult> {
  const kind = String(raw.kind ?? "") as CollectorKind;
  if (!["collection_site", "mro", "lab", "ctpa"].includes(kind)) return { ok: false, message: "Pick what it is." };
  const name = text(raw.name);
  if (!name) return { ok: false, message: "Give it a name." };
  const body = {
    kind,
    name,
    address: text(raw.address),
    contact_name: text(raw.contact_name),
    phone: text(raw.phone),
    after_hours_phone: text(raw.after_hours_phone),
    email: text(raw.email),
    notes: text(raw.notes),
    is_active: raw.is_active !== false,
  };
  try {
    if (collectorId) await updateCollector(collectorId, body);
    else await createCollector(body);
    refresh("/employees/drug-alcohol/collectors");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "save it") };
  }
}

// ---- The MIS form -----------------------------------------------------------------

export async function certifyMisAction(
  year: number,
  raw: { official_name: string; official_phone: string; prepared_by: string },
): Promise<DrugAlcoholResult> {
  const name = text(raw.official_name);
  if (!name) return { ok: false, message: "Enter the certifying official's name." };
  try {
    await certifyMis(year, { official_name: name, official_phone: text(raw.official_phone), prepared_by: text(raw.prepared_by) });
    refresh("/employees/drug-alcohol/report");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "certify the report") };
  }
}
