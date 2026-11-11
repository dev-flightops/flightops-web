import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, api, switchApi } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    api: {
      actOnEntry: vi.fn(),
      certifyMis: vi.fn(),
      createCollector: vi.fn(),
      createSelection: vi.fn(async () => ({ id: "sel-1" })),
      createTest: vi.fn(async () => ({ id: "test-1" })),
      returnToDuty: vi.fn(),
      saveProgram: vi.fn(),
      savePerson: vi.fn(),
      updateCollector: vi.fn(),
      updateTest: vi.fn(),
      uploadTestFile: vi.fn(),
    },
    switchApi: { updateDrugAlcoholBlocks: vi.fn() },
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/drug-alcohol", () => api);
vi.mock("@/lib/api/type-qualifications", () => switchApi);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createSelectionAction,
  logTestAction,
  returnToDutyAction,
  saveProgramAction,
  savePersonAction,
  setDrugAlcoholBlocksAction,
  type TestFormValues,
} from "./actions";

const USER = "11111111-1111-4111-8111-111111111111";

function form(over: Partial<TestFormValues> = {}): TestFormValues {
  return {
    test_type: "pre_employment",
    panel: "drug",
    test_date: "2026-11-02",
    collected_at: "",
    category: "flight_crewmember",
    result: "negative",
    drugs: [],
    refusal_reason: "",
    screening_level: "",
    confirmation_level: "",
    collection_site_id: "",
    mro_id: "",
    lab_id: "",
    specimen_id: " 0012345 ",
    split_requested: false,
    notes: "",
    ...over,
  };
}

const program = {
  der_user_id: USER,
  alternate_der_user_id: "",
  der_phone: "",
  drug_rate_pct: "25",
  alcohol_rate_pct: "10",
  safety_sensitive_roles: ["pilot"],
  faa_certificate_number: "",
  plan_number: "",
  ctpa_name: "",
  ctpa_phone: "",
};

beforeEach(() => vi.clearAllMocks());

describe("the program", () => {
  it("refuses rates under the FAA's minimums before asking the service", async () => {
    expect(await saveProgramAction({ ...program, drug_rate_pct: "20" })).toEqual({
      ok: false,
      message: "The FAA's minimum random drug rate is 25%.",
    });
    expect(await saveProgramAction({ ...program, alcohol_rate_pct: "5" })).toMatchObject({ ok: false });
    expect(api.saveProgram).not.toHaveBeenCalled();
  });

  it("saves blanks as nothing and the DER as picked", async () => {
    expect(await saveProgramAction(program)).toEqual({ ok: true });
    expect(api.saveProgram).toHaveBeenCalledWith(
      expect.objectContaining({ der_user_id: USER, alternate_der_user_id: null, der_phone: null, drug_rate_pct: 25 }),
    );
  });

  it("says who may change the release switch when the service refuses", async () => {
    switchApi.updateDrugAlcoholBlocks.mockRejectedValueOnce(new TestApiError(403, "/x", '{"detail":"insufficient_role"}'));
    expect(await setDrugAlcoholBlocksAction(true)).toEqual({
      ok: false,
      message: "The Director of Operations or an Exec Admin can change this.",
    });
  });
});

describe("the pool and selections", () => {
  it("needs a reason to leave someone out", async () => {
    expect(await savePersonAction(USER, { pool: "out", pool_note: " ", category: "" })).toMatchObject({ ok: false });
    expect(api.savePerson).not.toHaveBeenCalled();
    await savePersonAction(USER, { pool: "out", pool_note: "On leave", category: "maintenance" });
    expect(api.savePerson).toHaveBeenCalledWith(USER, { pool: "out", pool_note: "On leave", category: "maintenance" });
  });

  it("draws a count, or enters a named list", async () => {
    const base = { panel: "both", method: "drawn", count: "0", user_ids: [], period_label: "", source: "", notes: "" };
    expect(await createSelectionAction(base)).toEqual({ ok: false, message: "Say how many to draw." });
    expect(await createSelectionAction({ ...base, count: "2" })).toEqual({ ok: true, id: "sel-1" });
    expect(api.createSelection).toHaveBeenLastCalledWith(
      expect.objectContaining({ panel: "both", method: "drawn", count: 2, user_ids: undefined, source: null }),
    );
    const entered = { ...base, method: "entered", user_ids: [USER] };
    expect(await createSelectionAction(entered)).toEqual({
      ok: false,
      message: "Say whose list it is, e.g. the consortium.",
    });
    expect(await createSelectionAction({ ...entered, source: "Northern Consortium" })).toMatchObject({ ok: true });
  });
});

describe("tests", () => {
  it("sends the form's values as the service takes them", async () => {
    expect(await logTestAction(USER, form(), null)).toEqual({ ok: true, id: "test-1" });
    expect(api.createTest).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER,
        panel: "drug",
        test_type: "pre_employment",
        result: "negative",
        specimen_id: "0012345",
        collected_at: null,
        selection_entry_id: null,
      }),
    );
  });

  it("refuses a level that isn't a breath alcohol concentration", async () => {
    const r = await logTestAction(USER, form({ panel: "alcohol", result: "completed", screening_level: "2" }), null);
    expect(r).toEqual({
      ok: false,
      message: "Enter the screening level as a breath alcohol concentration, e.g. 0.025.",
    });
    expect(api.createTest).not.toHaveBeenCalled();
  });

  it("passes on the service's own sentence", async () => {
    api.createTest.mockRejectedValueOnce(
      new TestApiError(422, "/x", '{"detail":"a positive result names the drugs found"}'),
    );
    expect(await logTestAction(USER, form({ result: "positive" }), null)).toEqual({
      ok: false,
      message: "A positive result names the drugs found",
    });
  });

  it("says when someone can go back on duty, if it's too soon", async () => {
    api.returnToDuty.mockRejectedValueOnce(
      new TestApiError(409, "/x", JSON.stringify({ detail: { error: "too_soon", hold_ends_at: "2026-05-02T02:00:00+00:00" } })),
    );
    expect(await returnToDutyAction(USER, "test-1")).toEqual({
      ok: false,
      message: "Not yet: 8 hours haven't passed since the test.",
    });
  });
});
