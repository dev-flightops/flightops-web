import { beforeEach, expect, it, vi } from "vitest";
const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch: fetchApi, ApiError: class ApiError extends Error {} }));
import { GET } from "./route";
beforeEach(() => vi.clearAllMocks());
it("forwards invoice dates/customer through the authenticated API and downloads private CSV", async () => {
  fetchApi.mockResolvedValue("Invoice,Total USD\r\nINV-1,450.00\r\n");
  const customer = "1d998f8c-429e-426c-8345-e1306bcaa7cb";
  const response = await GET(new Request(`http://localhost/reservations/accounting-export/invoices?start=2026-11-01&end=2026-11-02&customer=${customer}`));
  expect(fetchApi).toHaveBeenCalledWith(`/billing/customer-invoices/export.csv?start=2026-11-01&end=2026-11-02&customer_id=${customer}`, { parseAs: "text" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-disposition")).toContain("peregrine_invoices_2026-11-01_2026-11-02.csv");
  expect(await response.text()).toContain("450.00");
});
it("refuses an inverted or malformed range without querying financial data", async () => {
  for (const range of ["start=2026-11-02&end=2026-11-01", "start=2026-02-30&end=2026-11-01"]) {
    expect((await GET(new Request(`http://localhost/export?${range}`))).status).toBe(400);
  }
  expect(fetchApi).not.toHaveBeenCalled();
});
