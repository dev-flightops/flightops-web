import { beforeEach, describe, expect, it, vi } from "vitest";

const { logCurrencyCompletion, TestApiError, revalidatePath } = vi.hoisted(
  () => {
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
      logCurrencyCompletion: vi.fn(),
      TestApiError,
      revalidatePath: vi.fn(),
    };
  },
);

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ logCurrencyCompletion }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { logCompletionAction } from "./log-completion-action";

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    pilot_user_id: "11111111-1111-1111-1111-111111111111",
    currency_item_id: "22222222-2222-2222-2222-222222222222",
    completion_date: "2026-06-15",
    completed_by: "Examiner Jane",
    examiner_cert_number: "ABC123",
    result: "pass",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  logCurrencyCompletion.mockReset();
  revalidatePath.mockClear();
});

describe("logCompletionAction", () => {
  it("returns success + revalidates both compliance paths on a 201", async () => {
    logCurrencyCompletion.mockResolvedValueOnce({
      completion_id: "c-1",
      cell: { status: "due_this_month" },
    });

    const result = await logCompletionAction({ status: "idle" }, makeFormData());

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.cell_status).toBe("due_this_month");
    }
    expect(revalidatePath).toHaveBeenCalledWith("/compliance/crew-currency");
    expect(revalidatePath).toHaveBeenCalledWith(
      "/compliance/pilots/11111111-1111-1111-1111-111111111111",
    );
  });

  it("returns field-error when completion_date is in the future", async () => {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 7);
    const fd = makeFormData({
      completion_date: future.toISOString().slice(0, 10),
    });

    const result = await logCompletionAction({ status: "idle" }, fd);

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.completion_date).toMatch(/future/i);
    }
    expect(logCurrencyCompletion).not.toHaveBeenCalled();
  });

  it("returns field-error when required completed_by is missing", async () => {
    const fd = makeFormData({ completed_by: "" });

    const result = await logCompletionAction({ status: "idle" }, fd);

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.completed_by).toMatch(/required/i);
    }
  });

  it("maps backend result_required_for_check_event to a field error", async () => {
    logCurrencyCompletion.mockRejectedValueOnce(
      new TestApiError(
        400,
        "/ops/compliance/completions",
        JSON.stringify({ detail: "result_required_for_check_event" }),
      ),
    );

    const result = await logCompletionAction(
      { status: "idle" },
      makeFormData({ result: "" }),
    );

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.result).toMatch(/pass.*fail/i);
    }
  });

  it("maps backend examiner_cert_required to a field error", async () => {
    logCurrencyCompletion.mockRejectedValueOnce(
      new TestApiError(
        400,
        "/ops/compliance/completions",
        JSON.stringify({ detail: "examiner_cert_required" }),
      ),
    );

    const result = await logCompletionAction(
      { status: "idle" },
      makeFormData({ examiner_cert_number: "" }),
    );

    expect(result.status).toBe("field-errors");
    if (result.status === "field-errors") {
      expect(result.errors.examiner_cert_number).toMatch(/examiner/i);
    }
  });

  it("maps rolling_items_use_elog_auto_fire to an api-error explaining the why", async () => {
    logCurrencyCompletion.mockRejectedValueOnce(
      new TestApiError(
        400,
        "/ops/compliance/completions",
        JSON.stringify({ detail: "rolling_items_use_elog_auto_fire" }),
      ),
    );

    const result = await logCompletionAction({ status: "idle" }, makeFormData());

    expect(result.status).toBe("api-error");
    if (result.status === "api-error") {
      expect(result.message).toMatch(/rolling items/i);
    }
  });

  it("maps 401 to the session-expired message", async () => {
    logCurrencyCompletion.mockRejectedValueOnce(
      new TestApiError(401, "/ops/compliance/completions", "Unauthorized"),
    );

    const result = await logCompletionAction({ status: "idle" }, makeFormData());

    expect(result.status).toBe("api-error");
    if (result.status === "api-error") {
      expect(result.message).toMatch(/session expired/i);
    }
  });

  it("validates the pilot_user_id is a UUID before hitting the API", async () => {
    const fd = makeFormData({ pilot_user_id: "not-a-uuid" });

    const result = await logCompletionAction({ status: "idle" }, fd);

    expect(result.status).toBe("field-errors");
    expect(logCurrencyCompletion).not.toHaveBeenCalled();
  });
});
