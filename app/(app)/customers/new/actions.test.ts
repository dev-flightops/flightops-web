import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createCustomer, redirectSpy } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    createCustomer: vi.fn(),
    redirectSpy: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/reservations", () => ({
  CUSTOMER_TYPES: ["individual", "corporate", "government", "non_profit"],
  createCustomer,
}));
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createCustomerAction } from "./actions";

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  createCustomer.mockReset();
});

describe("createCustomerAction", () => {
  it("marks the field a 422 refuses, with why (#134)", async () => {
    // "sweep@example.test" read "Backend rejected the request (HTTP 422)".
    createCustomer.mockRejectedValueOnce(
      new TestApiError(
        422,
        "/reservations/customers",
        JSON.stringify({
          detail: [
            {
              loc: ["body", "email"],
              msg: "value is not a valid email address: The part after the @-sign is a special-use or reserved name that cannot be used with email.",
            },
          ],
        }),
      ),
    );

    const state = await createCustomerAction(
      { status: "idle" },
      form({ full_name: "Sweep Test", customer_type: "corporate", email: "sweep@example.test" }),
    );

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toMatch(/^Email: The part after the @-sign/);
      expect(state.fieldErrors?.email).toMatch(/special-use or reserved name/);
      expect(state.message).not.toMatch(/HTTP 422/);
    }
  });
});
