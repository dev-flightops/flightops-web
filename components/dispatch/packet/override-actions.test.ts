import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createComplianceOverride,
  revalidatePath,
  TestApiError,
} = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return {
    createComplianceOverride: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/ops", () => ({ createComplianceOverride }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));

import { createOverridesAction } from "./override-actions";

const PILOT = "aaaaaaaa-0000-0000-0000-000000000001";
const ITEM_1 = "bbbbbbbb-0000-0000-0000-000000000001";
const ITEM_2 = "bbbbbbbb-0000-0000-0000-000000000002";
const FLIGHT = "cccccccc-0000-0000-0000-000000000001";
const LONG_REASON =
  "Supervisor personally briefed the pilot on the current status and confirmed compensating controls.";

beforeEach(() => {
  createComplianceOverride.mockReset();
  revalidatePath.mockReset();
});

describe("createOverridesAction (M2-G-5 tail)", () => {
  it("POSTs one override per currency item with the shared cert + reason", async () => {
    createComplianceOverride.mockResolvedValue({} as never);
    const result = await createOverridesAction(
      PILOT,
      [ITEM_1, ITEM_2],
      "CFI-9999",
      LONG_REASON,
      FLIGHT,
    );
    expect(result).toEqual({ status: "ok", count: 2 });
    expect(createComplianceOverride).toHaveBeenCalledTimes(2);
    expect(createComplianceOverride).toHaveBeenNthCalledWith(1, {
      pilot_user_id: PILOT,
      currency_item_id: ITEM_1,
      flight_id: FLIGHT,
      supervisor_cert_number: "CFI-9999",
      reason: LONG_REASON,
    });
    expect(createComplianceOverride).toHaveBeenNthCalledWith(2, {
      pilot_user_id: PILOT,
      currency_item_id: ITEM_2,
      flight_id: FLIGHT,
      supervisor_cert_number: "CFI-9999",
      reason: LONG_REASON,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dispatch/");
    expect(revalidatePath).toHaveBeenCalledWith(`/dispatch/${FLIGHT}`);
  });

  it("returns field errors when the reason is under 50 chars", async () => {
    const result = await createOverridesAction(
      PILOT,
      [ITEM_1],
      "CFI-9999",
      "short",
      FLIGHT,
    );
    expect(result.status).toBe("field-errors");
    expect(
      (result as { errors: Record<string, string> }).errors.reason,
    ).toMatch(/at least 50 characters/);
    expect(createComplianceOverride).not.toHaveBeenCalled();
  });

  it("returns field errors when the cert number is empty", async () => {
    const result = await createOverridesAction(
      PILOT,
      [ITEM_1],
      "   ",
      LONG_REASON,
      FLIGHT,
    );
    expect(result.status).toBe("field-errors");
    expect(
      (result as { errors: Record<string, string> }).errors
        .supervisor_cert_number,
    ).toMatch(/required/i);
  });

  it("returns 'no items selected' when the currency-item list is empty", async () => {
    const result = await createOverridesAction(
      PILOT,
      [],
      "CFI-9999",
      LONG_REASON,
      FLIGHT,
    );
    expect(result.status).toBe("field-errors");
    expect((result as { errors: Record<string, string> }).errors._).toMatch(
      /No hard-block items selected/,
    );
  });

  it("maps 403 into a role-based api-error", async () => {
    createComplianceOverride.mockRejectedValueOnce(
      new TestApiError(
        403,
        "/ops/compliance/overrides",
        JSON.stringify({ detail: "forbidden" }),
      ),
    );
    const result = await createOverridesAction(
      PILOT,
      [ITEM_1],
      "CFI-9999",
      LONG_REASON,
      FLIGHT,
    );
    expect(result).toEqual({
      status: "api-error",
      message: expect.stringMatching(/don't have permission/i),
    });
  });
});
