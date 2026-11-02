import { describe, expect, it, vi } from "vitest";
const submit = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {
  constructor(public status: number, public path: string, message: string) { super(message); }
} }));
vi.mock("@/lib/api/ops", () => ({ submitPilotAcceptance: submit }));
import { ApiError } from "@/lib/api/client";
import { submitPilotAcceptanceAction } from "./actions";

describe("pilot acceptance refusal", () => {
  it("explains the daily aircraft preflight prerequisite instead of a generic 409", async () => {
    const message = "Nobody has preflighted N94DM today. Take it on Flight Crew and record its preflight and run-up first.";
    submit.mockRejectedValueOnce(new ApiError(409, "/acceptance", JSON.stringify({
      detail: { error: "aircraft_not_preflighted", message },
    })));
    expect(await submitPilotAcceptanceAction("flight", { accepted: true })).toEqual({ ok: false, error: message });
  });
  it("keeps a useful fallback when the service returns only the error code", async () => {
    submit.mockRejectedValueOnce(new ApiError(409, "/acceptance", "aircraft_not_preflighted"));
    expect(await submitPilotAcceptanceAction("flight", { accepted: true })).toMatchObject({
      ok: false, error: expect.stringContaining("daily preflight and run-up"),
    });
  });
});
