import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ ask: vi.fn(), zones: vi.fn() }));
vi.mock("@/lib/api/ai", () => ({ askFleetBrain: mocks.ask }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: mocks.zones }));
vi.mock("@/lib/api/client", () => ({ ApiError: class ApiError extends Error {} }));
import { askAction } from "./actions";
beforeEach(() => vi.clearAllMocks());
it("uses the company zone for relative dates instead of a viewer or container day", async () => {
  mocks.zones.mockResolvedValue({ fallback: "America/Anchorage", byIcao: {} });
  mocks.ask.mockResolvedValue({ answer: "test" });
  expect((await askAction("  What maintenance is due this week?  ")).ok).toBe(true);
  expect(mocks.ask).toHaveBeenCalledWith("What maintenance is due this week?", "America/Anchorage");
});
it("does not query when the question is blank", async () => {
  expect((await askAction(" ")).ok).toBe(false);
  expect(mocks.ask).not.toHaveBeenCalled();
});
