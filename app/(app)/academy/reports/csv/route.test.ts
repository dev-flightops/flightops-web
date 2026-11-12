import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, getAcademyReportCsv } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getAcademyReportCsv: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/academy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/academy")>()),
  getAcademyReportCsv,
}));

import { GET } from "./route";

const get = (qs: string) => GET(new Request(`https://www.example.test/academy/reports/csv?${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  getAcademyReportCsv.mockResolvedValue("Employee,Course\r\n");
});

describe("Academy Reports → Export CSV", () => {
  it("asks for the report with the filters it takes, as a download", async () => {
    const r = await get("report=overdue&role=pilot&from=2026-11-01&category=safety");
    expect(getAcademyReportCsv).toHaveBeenCalledWith("overdue", { category: "safety", role: "pilot" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(r.headers.get("content-disposition")).toMatch(/^attachment; filename="academy_overdue_\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(await r.text()).toBe("Employee,Course\r\n");
  });

  it("refuses a start after the end", async () => {
    const r = await get("report=by-course&from=2026-11-10&to=2026-11-01");
    expect(r.status).toBe(400);
    expect(getAcademyReportCsv).not.toHaveBeenCalled();
  });

  it("says who the reports are for when the service refuses", async () => {
    getAcademyReportCsv.mockRejectedValue(new TestApiError(403, "/academy/reports/by-employee/csv", ""));
    const r = await get("report=by-employee");
    expect(r.status).toBe(403);
    expect((await r.json()).error).toMatch(/Chief Pilot/);
  });
});
