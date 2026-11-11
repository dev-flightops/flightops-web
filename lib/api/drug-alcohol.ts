/**
 * DOT drug and alcohol testing: the documents service's /drug-alcohol, and
 * ops' release switch and crew read.
 *
 * Run by the program's DER, its alternate and the Exec Admins (Greg,
 * 11 Nov; 49 CFR 40.321). The leaders see who's cleared for safety-sensitive
 * duty, yes or no. Everyone sees their own tests.
 */

import { apiFetch } from "./client";

export type TestType =
  | "pre_employment"
  | "random"
  | "post_accident"
  | "reasonable_suspicion"
  | "return_to_duty"
  | "follow_up";
export type Panel = "drug" | "alcohol";
export type SelectionPanel = Panel | "both";
export type FaaCategory =
  | "flight_crewmember"
  | "flight_attendant"
  | "flight_instructor"
  | "aircraft_dispatcher"
  | "maintenance"
  | "ground_security_coordinator"
  | "aviation_screener"
  | "air_traffic_controller"
  | "operations_control_specialist";
export type CollectorKind = "collection_site" | "mro" | "lab" | "ctpa";
export type FileKind = "chain_of_custody" | "lab_results" | "mro_letter" | "other";
export type ClearanceReason = "no_pre_employment" | "violation" | "alcohol_hold";
export type EntryStatus = "selected" | "notified" | "tested" | "excused";

export interface PersonRef {
  id: string;
  full_name: string;
  email: string | null;
}

export interface Clearance {
  cleared: boolean;
  reasons: ClearanceReason[];
  hold_ends_at: string | null;
}

export interface DrugAlcoholAccess {
  runs_program: boolean;
  sees_clearance: boolean;
  der: PersonRef | null;
  alternate_der: PersonRef | null;
  der_phone: string | null;
  release_blocks: boolean;
}

export interface Program {
  saved: boolean;
  der: PersonRef | null;
  alternate_der: PersonRef | null;
  der_phone: string | null;
  drug_rate_pct: number;
  alcohol_rate_pct: number;
  safety_sensitive_roles: string[];
  faa_certificate_number: string | null;
  plan_number: string | null;
  ctpa_name: string | null;
  ctpa_phone: string | null;
}

export interface ProgramInput {
  der_user_id: string | null;
  alternate_der_user_id: string | null;
  der_phone: string | null;
  drug_rate_pct: number;
  alcohol_rate_pct: number;
  safety_sensitive_roles: string[];
  faa_certificate_number: string | null;
  plan_number: string | null;
  ctpa_name: string | null;
  ctpa_phone: string | null;
}

export interface CollectorRef {
  id: string;
  kind: CollectorKind;
  name: string;
}

export interface TestFile {
  id: string;
  kind: FileKind;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface TestRecord {
  id: string;
  user_id: string;
  full_name: string | null;
  test_type: TestType;
  test_type_label: string;
  panel: Panel;
  test_date: string;
  collected_at: string | null;
  category: FaaCategory;
  category_label: string;
  result: string | null;
  result_label: string;
  violation: boolean;
  drugs: string[];
  refusal_reason: string | null;
  screening_level: number | null;
  confirmation_level: number | null;
  collection_site: CollectorRef | null;
  mro: CollectorRef | null;
  lab: CollectorRef | null;
  specimen_id: string | null;
  split_requested: boolean;
  selection_entry_id: string | null;
  notes: string | null;
  returned_to_duty_at: string | null;
  returned_to_duty_by: PersonRef | null;
  hold_ends_at: string | null;
  recorded_by: PersonRef | null;
  created_at: string;
  files: TestFile[];
}

/** A test as entered. `result` is a drug result, or for alcohol
 *  `completed` (the service works the result out from the levels),
 *  `refusal` or `cancelled`; null while it waits on the result. */
export interface TestInput {
  test_type: TestType;
  test_date: string;
  collected_at: string | null;
  category: FaaCategory | null;
  result: string | null;
  drugs: string[];
  refusal_reason: string | null;
  screening_level: string | null;
  confirmation_level: string | null;
  collection_site_id: string | null;
  mro_id: string | null;
  lab_id: string | null;
  specimen_id: string | null;
  split_requested: boolean;
  notes: string | null;
}

export interface RandomRate {
  panel: Panel;
  rate_pct: number;
  basis: "average" | "today";
  average_pool: number;
  selections: number;
  required: number;
  done: number;
  met: boolean;
}

export interface SelectionRow {
  id: string;
  panel: SelectionPanel;
  method: "drawn" | "entered";
  period_label: string | null;
  selected_at: string;
  selected_by: PersonRef | null;
  pool_size: number;
  selected_count: number;
  source: string | null;
  notes: string | null;
  open: number | null;
}

export interface SelectionEntry {
  id: string;
  user_id: string;
  full_name: string | null;
  panel: Panel;
  status: EntryStatus;
  notified_at: string | null;
  notified_by: PersonRef | null;
  excused_reason: string | null;
  closed_at: string | null;
  test: { id: string; test_date: string; result: string | null; result_label: string } | null;
}

export interface SelectionDetail extends SelectionRow {
  seed: string | null;
  pool: { user_id: string; full_name: string | null; category: FaaCategory | null }[];
  entries: SelectionEntry[];
}

export interface PoolPerson {
  user_id: string;
  full_name: string;
  roles: string[];
  title: string | null;
  station: string | null;
  hire_date: string | null;
  in_pool: boolean;
  covered: boolean;
  why: "role" | "added" | "left_out" | "not_covered";
  pool: "auto" | "in" | "out";
  pool_note: string | null;
  category: FaaCategory | null;
  category_set: boolean;
  clearance: Clearance | null;
}

export interface Pool {
  safety_sensitive_roles: string[];
  pool_size: number;
  people: PoolPerson[];
}

export interface OpenEntry {
  id: string;
  selection_id: string;
  selected_at: string;
  period_label: string | null;
  user_id?: string;
  full_name?: string | null;
  panel: Panel;
  status: EntryStatus;
  notified_at: string | null;
}

export interface Overview {
  year: number;
  program: Program;
  pool_size: number;
  random: RandomRate[];
  tests_this_year: { drug: number; alcohol: number; violations: number };
  not_cleared: (Clearance & { user_id: string; full_name: string; in_pool: boolean })[];
  open_entries: OpenEntry[];
  pending_results: {
    id: string;
    user_id: string;
    full_name: string | null;
    test_type_label: string;
    panel: Panel;
    test_date: string;
  }[];
  recent_tests: TestRecord[];
  recent_selections: SelectionRow[];
}

export interface EmployeeTests {
  person: PoolPerson;
  tests: TestRecord[];
  open_entries: OpenEntry[];
}

export interface Collector {
  id: string;
  kind: CollectorKind;
  kind_label: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  phone: string | null;
  after_hours_phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
}

export type CollectorInput = Omit<Collector, "id" | "kind_label">;

export interface MisRow {
  test_type: TestType | "total";
  label: string;
  cells: number[];
}

export interface MisForm {
  year: number;
  employer: {
    company_name: string;
    dba: string | null;
    address: string | null;
    email: string | null;
    faa_certificate_number: string | null;
    plan_number: string | null;
    ctpa_name: string | null;
    ctpa_phone: string | null;
    der_name: string | null;
    der_phone: string | null;
    der_email: string | null;
  };
  covered: { basis: "average" | "today"; selections: number; total: number; categories: number; unset: number };
  random: RandomRate[];
  forms: { category: FaaCategory | "unset"; label: string; employees: number; drug: MisRow[]; alcohol: MisRow[] }[];
  pending: number;
  drug_columns: string[];
  alcohol_columns: string[];
}

export interface MisCertification {
  certified_at: string;
  certified_by: PersonRef | null;
  official_name: string;
  official_phone: string | null;
  prepared_by: string | null;
  changed_since: boolean;
}

export interface MisReport {
  form: MisForm;
  certification: MisCertification | null;
  can_certify: boolean;
  years?: number[];
}

export interface ClearanceList {
  release_blocks: boolean;
  items: { user_id: string; full_name: string; roles: string[]; in_pool: boolean; cleared: boolean }[];
}

export interface MyTests {
  clearance: Clearance;
  tests: TestRecord[];
}

export interface DrugAlcoholWaiting {
  runs_program: boolean;
  sees_clearance: boolean;
  not_cleared?: number;
  to_test?: number;
  pending_results?: number;
  ready_to_return?: number;
}

export interface CrewClearance {
  blocks: boolean;
  crew: { user_id: string; full_name: string; seat: "pic" | "sic"; cleared: boolean }[];
}

const BASE = "/drug-alcohol";

export async function getDrugAlcoholAccess(): Promise<DrugAlcoholAccess> {
  return apiFetch<DrugAlcoholAccess>(`${BASE}/access`);
}

export async function getProgram(): Promise<Program> {
  return apiFetch<Program>(`${BASE}/program`);
}

export async function saveProgram(body: ProgramInput): Promise<Program> {
  return apiFetch<Program>(`${BASE}/program`, { method: "PUT", body: JSON.stringify(body) });
}

export async function getOverview(): Promise<Overview> {
  return apiFetch<Overview>(`${BASE}/overview`);
}

export async function getPool(): Promise<Pool> {
  return apiFetch<Pool>(`${BASE}/pool`);
}

export async function savePerson(
  userId: string,
  body: { pool: "auto" | "in" | "out"; pool_note: string | null; category: FaaCategory | null },
): Promise<PoolPerson> {
  return apiFetch<PoolPerson>(`${BASE}/people/${userId}`, { method: "PUT", body: JSON.stringify(body) });
}

export async function listSelections(): Promise<{ items: SelectionRow[] }> {
  return apiFetch<{ items: SelectionRow[] }>(`${BASE}/selections`);
}

export async function createSelection(body: {
  panel: SelectionPanel;
  method: "drawn" | "entered";
  count?: number;
  user_ids?: string[];
  period_label: string | null;
  source: string | null;
  notes: string | null;
}): Promise<SelectionDetail> {
  return apiFetch<SelectionDetail>(`${BASE}/selections`, { method: "POST", body: JSON.stringify(body) });
}

export async function getSelection(id: string): Promise<SelectionDetail> {
  return apiFetch<SelectionDetail>(`${BASE}/selections/${id}`);
}

export async function actOnEntry(
  entryId: string,
  body: { action: "notify" | "excuse" | "reopen"; reason?: string | null },
): Promise<SelectionDetail> {
  return apiFetch<SelectionDetail>(`${BASE}/selection-entries/${entryId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getEmployeeTests(userId: string): Promise<EmployeeTests> {
  return apiFetch<EmployeeTests>(`${BASE}/employees/${userId}`);
}

export async function createTest(
  body: TestInput & { user_id: string; panel: Panel; selection_entry_id: string | null },
): Promise<TestRecord> {
  return apiFetch<TestRecord>(`${BASE}/tests`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateTest(testId: string, body: TestInput): Promise<TestRecord> {
  return apiFetch<TestRecord>(`${BASE}/tests/${testId}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function returnToDuty(testId: string): Promise<TestRecord> {
  return apiFetch<TestRecord>(`${BASE}/tests/${testId}/return-to-duty`, { method: "POST" });
}

export async function uploadTestFile(testId: string, form: FormData): Promise<TestFile> {
  return apiFetch<TestFile>(`${BASE}/tests/${testId}/files`, { method: "POST", body: form });
}

export async function listCollectors(): Promise<{ items: Collector[] }> {
  return apiFetch<{ items: Collector[] }>(`${BASE}/collectors`);
}

export async function createCollector(body: CollectorInput): Promise<Collector> {
  return apiFetch<Collector>(`${BASE}/collectors`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateCollector(id: string, body: CollectorInput): Promise<Collector> {
  return apiFetch<Collector>(`${BASE}/collectors/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function getMisReport(year?: number): Promise<MisReport> {
  return apiFetch<MisReport>(`${BASE}/mis${year ? `?year=${year}` : ""}`);
}

export async function certifyMis(
  year: number,
  body: { official_name: string; official_phone: string | null; prepared_by: string | null },
): Promise<MisReport> {
  return apiFetch<MisReport>(`${BASE}/mis/${year}/certify`, { method: "POST", body: JSON.stringify(body) });
}

export async function getClearance(userIds?: string[]): Promise<ClearanceList> {
  const query = userIds && userIds.length > 0 ? `?${userIds.map((id) => `user_id=${id}`).join("&")}` : "";
  return apiFetch<ClearanceList>(`${BASE}/clearance${query}`);
}

export async function getMyTests(): Promise<MyTests> {
  return apiFetch<MyTests>(`${BASE}/my-tests`);
}

export async function getDrugAlcoholWaiting(): Promise<DrugAlcoholWaiting> {
  return apiFetch<DrugAlcoholWaiting>(`${BASE}/waiting`);
}

/** Ops: whether release holds on the program and, when it does, whether
 *  each pilot on the flight is cleared. */
export async function getCrewClearance(flightId: string): Promise<CrewClearance> {
  return apiFetch<CrewClearance>(`/ops/flights/${flightId}/crew-clearance`);
}
