import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, reviewSafetyReport, revalidatePath } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, reviewSafetyReport: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/safety-reports", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/safety-reports")>()),
  reviewSafetyReport,
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { reviewSafetyReportAction } from "./actions";

const REPORT = "8f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
const REVIEWER = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function form(fields: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base = {
    report_id: REPORT,
    status: "under_review",
    assigned_to_user_id: REVIEWER,
    resolution: "",
    severity: "3",
    likelihood: "",
    ...fields,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  reviewSafetyReport.mockReset();
  revalidatePath.mockClear();
});

describe("reviewing a safety report", () => {
  it("sends every field, a blank one as a clear", async () => {
    reviewSafetyReport.mockResolvedValueOnce({});
    const state = await reviewSafetyReportAction({ status: "idle", attempt: 0 }, form());
    expect(reviewSafetyReport).toHaveBeenCalledWith(REPORT, {
      status: "under_review",
      assigned_to_user_id: REVIEWER,
      resolution: null,
      severity: 3,
      likelihood: null,
    });
    expect(state).toEqual({ status: "ok", attempt: 1 });
    expect(revalidatePath).toHaveBeenCalledWith(`/safety/reports/${REPORT}`);
  });

  it("unassigns on a blank assignee", async () => {
    reviewSafetyReport.mockResolvedValueOnce({});
    await reviewSafetyReportAction({ status: "idle", attempt: 0 }, form({ assigned_to_user_id: "" }));
    expect(reviewSafetyReport.mock.calls[0][1]).toMatchObject({ assigned_to_user_id: null });
  });

  it("explains an assignee the service refuses, keeping what was sent", async () => {
    reviewSafetyReport.mockRejectedValueOnce(
      new TestApiError(422, `/safety/reports/${REPORT}`, '{"detail":"assignee_must_be_a_reviewer"}'),
    );
    const state = await reviewSafetyReportAction(
      { status: "idle", attempt: 4 },
      form({ resolution: "Talked to the fueler." }),
    );
    expect(state.status).toBe("error");
    expect(state.attempt).toBe(5);
    expect(state.message).toMatch(/can't be assigned this report/);
    expect(state.values?.resolution).toBe("Talked to the fueler.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a status the service does not have", async () => {
    const state = await reviewSafetyReportAction({ status: "idle", attempt: 0 }, form({ status: "triaged" }));
    expect(state.status).toBe("error");
    expect(reviewSafetyReport).not.toHaveBeenCalled();
  });

  it("says when the report has gone out of reach", async () => {
    reviewSafetyReport.mockRejectedValueOnce(new TestApiError(404, `/safety/reports/${REPORT}`, "report_not_found"));
    const state = await reviewSafetyReportAction({ status: "idle", attempt: 0 }, form());
    expect(state.message).toBe("This report is no longer available to you.");
  });
});
