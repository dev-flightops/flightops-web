import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authoriseTypePosition,
  revokeTypePosition,
  logCurrencyCompletion,
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
    authoriseTypePosition: vi.fn(),
    revokeTypePosition: vi.fn(),
    logCurrencyCompletion: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ logCurrencyCompletion }));
vi.mock("@/lib/api/type-qualifications", () => ({
  authoriseTypePosition,
  revokeTypePosition,
}));

import {
  authorisePositionAction,
  recordCheckRideAction,
  revokePositionAction,
} from "./type-qualification-actions";

const PILOT = "11111111-1111-4111-8111-111111111111";
const QUAL = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";

const apiError = (status: number, detail: string) =>
  new TestApiError(status, "/ops/x", JSON.stringify({ detail }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authorisePositionAction", () => {
  const input = {
    airframe_type: " Caravan ",
    position: "pic" as const,
    authorised_on: "2026-09-01",
    notes: "",
  };

  it("sends the type as the fleet's slug and refreshes every view of it", async () => {
    authoriseTypePosition.mockResolvedValue({});
    expect(await authorisePositionAction(PILOT, input)).toEqual({ ok: true });
    expect(authoriseTypePosition).toHaveBeenCalledWith(PILOT, {
      airframe_type: "caravan",
      position: "pic",
      authorised_on: "2026-09-01",
      notes: null,
    });
    const paths = revalidatePath.mock.calls.map(([p]) => p);
    expect(paths).toEqual(
      expect.arrayContaining([
        `/compliance/pilots/${PILOT}`,
        "/compliance/type-qualifications",
        "/compliance/roster",
      ]),
    );
  });

  it("refuses a future date before asking the service", async () => {
    const outcome = await authorisePositionAction(PILOT, {
      ...input,
      authorised_on: "2999-01-01",
    });
    expect(outcome).toEqual({ ok: false, error: "The date can't be in the future." });
    expect(authoriseTypePosition).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a pilot's", async () => {
    const outcome = await authorisePositionAction("../../billing", input);
    expect(outcome.ok).toBe(false);
    expect(authoriseTypePosition).not.toHaveBeenCalled();
  });

  it("says plainly when the position is already held", async () => {
    authoriseTypePosition.mockRejectedValue(apiError(409, "position_already_authorised"));
    expect(await authorisePositionAction(PILOT, input)).toEqual({
      ok: false,
      error:
        "That position is already authorised on this type. Refresh the page to see it.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("names who may authorise when the service refuses the viewer", async () => {
    authoriseTypePosition.mockRejectedValue(apiError(403, "forbidden"));
    expect(await authorisePositionAction(PILOT, input)).toEqual({
      ok: false,
      error:
        "Only a Chief Pilot, Director of Operations or Exec Admin can authorise the position.",
    });
  });
});

describe("revokePositionAction", () => {
  it("revokes by the authorisation's id", async () => {
    revokeTypePosition.mockResolvedValue({});
    const outcome = await revokePositionAction(PILOT, QUAL, {
      revoked_on: "2026-10-01",
      notes: " Left the company ",
    });
    expect(outcome).toEqual({ ok: true });
    expect(revokeTypePosition).toHaveBeenCalledWith(QUAL, {
      revoked_on: "2026-10-01",
      notes: "Left the company",
    });
  });

  it("explains a revoked date before the authorised one", async () => {
    revokeTypePosition.mockRejectedValue(apiError(400, "revoked_before_authorised"));
    expect(
      await revokePositionAction(PILOT, QUAL, { revoked_on: "2020-01-01", notes: "" }),
    ).toEqual({
      ok: false,
      error: "The revoked date is before the date the position was authorised.",
    });
  });
});

describe("recordCheckRideAction", () => {
  const input = {
    currency_item_id: ITEM,
    airframe_type: "kingair",
    completion_date: "2026-10-02",
    result: "pass" as const,
    completed_by: " Dana Check ",
    examiner_cert_number: "",
    notes: "",
  };

  it("logs one currency completion that names the type", async () => {
    logCurrencyCompletion.mockResolvedValue({ completion_id: "c", cell: {} });
    expect(await recordCheckRideAction(PILOT, input)).toEqual({ ok: true });
    expect(logCurrencyCompletion).toHaveBeenCalledWith({
      pilot_user_id: PILOT,
      currency_item_id: ITEM,
      airframe_type: "kingair",
      completion_date: "2026-10-02",
      result: "pass",
      completed_by: "Dana Check",
      examiner_cert_number: null,
      notes: null,
      score: null,
    });
    // The board reads the same completion.
    expect(revalidatePath).toHaveBeenCalledWith("/compliance/crew-currency");
  });

  it("needs a result", async () => {
    const outcome = await recordCheckRideAction(PILOT, {
      ...input,
      result: "" as "pass",
    });
    expect(outcome).toEqual({ ok: false, error: "Pick Pass or Fail." });
    expect(logCurrencyCompletion).not.toHaveBeenCalled();
  });

  it("cannot log against a check the company has not set up", async () => {
    const outcome = await recordCheckRideAction(PILOT, { ...input, currency_item_id: "" });
    expect(outcome).toEqual({
      ok: false,
      error: "This check isn't set up as a currency item yet.",
    });
  });

  it("passes on the service's reasons", async () => {
    logCurrencyCompletion.mockRejectedValueOnce(apiError(400, "examiner_cert_required"));
    expect(await recordCheckRideAction(PILOT, input)).toEqual({
      ok: false,
      error: "This check needs the examiner's certificate number.",
    });
    logCurrencyCompletion.mockRejectedValueOnce(apiError(422, "unknown_airframe_type"));
    expect(await recordCheckRideAction(PILOT, input)).toEqual({
      ok: false,
      error: "That aircraft type isn't in the fleet.",
    });
  });

  it("names the sign-off roles when the viewer may not record", async () => {
    logCurrencyCompletion.mockRejectedValue(apiError(403, "forbidden"));
    expect(await recordCheckRideAction(PILOT, input)).toEqual({
      ok: false,
      error:
        "Only a Chief Pilot, Check Airman, Director of Operations or Exec Admin can record the check.",
    });
  });
});
