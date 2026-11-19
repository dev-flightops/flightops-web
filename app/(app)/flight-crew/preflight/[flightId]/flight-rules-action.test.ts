import { beforeEach, describe, expect, it, vi } from "vitest";

const { setFlightRules, revalidatePath } = vi.hoisted(() => ({ setFlightRules: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/ops", () => ({ setFlightRules }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {
  constructor(public status: number, public path: string, message: string) { super(message); }
} }));
import { ApiError } from "@/lib/api/client";
import { setFlightRulesAction } from "./actions";

beforeEach(() => {
  setFlightRules.mockReset();
  revalidatePath.mockReset();
});

describe("setFlightRulesAction", () => {
  it("sets the rules and draws the preflight again", async () => {
    setFlightRules.mockResolvedValueOnce({});
    expect(await setFlightRulesAction("f-1", true)).toEqual({ ok: true });
    expect(setFlightRules).toHaveBeenCalledWith("f-1", true);
    expect(revalidatePath).toHaveBeenCalledWith("/flight-crew/preflight/f-1");
  });

  it("sends an IFR flight's alternate when given (#201)", async () => {
    setFlightRules.mockResolvedValueOnce({});
    expect(await setFlightRulesAction("f-1", true, "PABE")).toEqual({ ok: true });
    expect(setFlightRules).toHaveBeenCalledWith("f-1", true, "PABE");
  });

  it("says an airport isn't known", async () => {
    setFlightRules.mockRejectedValueOnce(
      new ApiError(422, "/flight-rules", JSON.stringify({ detail: { error: "unknown_airport", codes: ["ZZZZ"] } })),
    );
    const result = await setFlightRulesAction("f-1", true, "ZZZZ");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^ZZZZ isn't an airport we know/);
  });

  it.each([
    [403, "Only the flight's own pilots and dispatch choose its rules."],
    [409, "The flight is released under its rules. Ask dispatch to pull the release back to change them."],
  ])("explains a %i", async (status, error) => {
    setFlightRules.mockRejectedValueOnce(new ApiError(status, "/flight-rules", "{}"));
    expect(await setFlightRulesAction("f-1", true)).toEqual({ ok: false, error });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
