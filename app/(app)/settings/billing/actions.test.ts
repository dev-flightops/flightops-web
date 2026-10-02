import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCheckoutSession, createPortalSession, redirect, TestApiError } =
  vi.hoisted(() => {
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
      createCheckoutSession: vi.fn(),
      createPortalSession: vi.fn(),
      // next/navigation's redirect() throws; the actions let it through.
      redirect: vi.fn((url: string) => {
        throw Object.assign(new Error("NEXT_REDIRECT"), {
          digest: `NEXT_REDIRECT;replace;${url};307;`,
        });
      }),
      TestApiError,
    };
  });

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/billing", () => ({ createCheckoutSession, createPortalSession }));

import { openPortalAction, startCheckoutAction } from "./actions";

const IDLE = { status: "idle" as const };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

function refused(status: number, detail: string) {
  return new TestApiError(status, "/billing/x", JSON.stringify({ detail }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startCheckoutAction", () => {
  it("sends the plan and seats only; no return URL comes from the page", async () => {
    createCheckoutSession.mockResolvedValue({
      session_id: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });

    await expect(
      startCheckoutAction(
        IDLE,
        form({
          plan_code: "growth",
          seat_count: "10",
          origin: "https://evil.example",
          success_path: "/stolen",
          cancel_path: "/stolen",
        }),
      ),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });

    expect(createCheckoutSession).toHaveBeenCalledWith({
      plan_code: "growth",
      seat_count: 10,
    });
    expect(redirect).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_1");
  });

  it.each([
    ["already_subscribed", 409, /already has a subscription.*use Manage billing/],
    ["stripe_refused", 502, /Stripe turned the request down, so nothing was charged or changed/],
    ["stripe_unavailable", 502, /Stripe didn't respond, so nothing was charged or changed/],
    ["stripe_not_configured", 503, /Billing isn't set up on this system yet/],
    ["web_origin_not_configured", 503, /Billing isn't set up on this system yet/],
    ["plan_not_available_for_checkout", 400, /This plan can't be bought here yet/],
    ["seat_count_exceeds_plan_limit", 400, /more seats than this plan allows/],
  ])("explains %s in plain words", async (detail, status, message) => {
    createCheckoutSession.mockRejectedValue(refused(status, detail));

    const state = await startCheckoutAction(IDLE, form({ plan_code: "growth", seat_count: "5" }));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(message);
    expect(state.message).not.toMatch(/price id|HTTP \d/);
  });

  it("names who can manage billing on a 403", async () => {
    createCheckoutSession.mockRejectedValue(refused(403, "insufficient_role"));

    const state = await startCheckoutAction(IDLE, form({ plan_code: "growth" }));

    expect(state.message).toBe(
      "Only an Executive Admin or a Director of Operations can manage billing.",
    );
  });
});

describe("openPortalAction", () => {
  it("asks for a portal session with no return URL from the page", async () => {
    createPortalSession.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test_1",
    });

    await expect(openPortalAction(IDLE, form({ origin: "https://evil.example" }))).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });

    expect(createPortalSession).toHaveBeenCalledWith();
    expect(redirect).toHaveBeenCalledWith("https://billing.stripe.com/p/session/test_1");
  });

  it("explains a Stripe refusal in plain words", async () => {
    createPortalSession.mockRejectedValue(refused(502, "stripe_refused"));

    const state = await openPortalAction(IDLE, form({}));

    expect(state).toEqual({
      status: "error",
      message:
        "Stripe turned the request down, so nothing was charged or changed. Ask your Peregrine contact to look at the billing log.",
    });
  });
});
