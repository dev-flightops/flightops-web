import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pick: vi.fn(), record: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {
  constructor(public status: number, public path: string, message: string) { super(message); }
} }));
vi.mock("@/lib/api/morning", () => ({ pickMorningAircraft: mocks.pick, recordMorningPreflight: mocks.record }));
import { ApiError } from "@/lib/api/client";
import { saveMorningPreflightAction, takeAircraftAction } from "./morning-actions";
const id = "a950c444-0edf-4d9b-ad54-18d3027f1940";
beforeEach(() => { vi.clearAllMocks(); mocks.pick.mockResolvedValue({}); mocks.record.mockResolvedValue({}); });
describe("daily aircraft actions", () => {
  it("preserves backend unavailability reasons and does not report success", async () => {
    mocks.pick.mockRejectedValueOnce(new ApiError(409, "/pick", JSON.stringify({ detail: { message: "N94DM is taken by another pilot." } })));
    expect(await takeAircraftAction(id)).toEqual({ ok: false, error: "N94DM is taken by another pilot." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("requires confirmation and validates quantities before writing", async () => {
    for (const body of [
      { completed: false, fuel_gallons: 100, oil_quarts: 10, notes: null },
      { completed: true, fuel_gallons: -1, oil_quarts: 10, notes: null },
      { completed: true, fuel_gallons: NaN, oil_quarts: 10, notes: null },
    ]) expect(await saveMorningPreflightAction(id, body)).toMatchObject({ ok: false });
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("records the check and refreshes flight acceptance views", async () => {
    expect(await saveMorningPreflightAction(id, { completed: true, fuel_gallons: 100, oil_quarts: 10, notes: "Synthetic run-up" })).toEqual({ ok: true });
    expect(mocks.record).toHaveBeenCalledWith(id, { fuel_gallons: 100, oil_quarts: 10, notes: "Synthetic run-up" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/flight-crew/preflight", "layout");
  });
});
