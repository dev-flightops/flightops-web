import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, updateCompanyProfile } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, updateCompanyProfile: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ updateCompanyProfile }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateCompanyAction } from "./actions";

/**
 * The invoicing fields of Settings → Company: what the action sends to
 * auth-service for what was typed. The tax is typed as a percentage and
 * stored as a fraction, and nothing may be rounded on the way.
 */

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const IDLE = { status: "idle" } as const;

beforeEach(() => {
  updateCompanyProfile.mockReset().mockResolvedValue({});
});

describe("the invoicing fields", () => {
  it("sends the rate to four decimals, the tax as a fraction, and the days", async () => {
    const state = await updateCompanyAction(
      IDLE,
      form({
        legal_name: "Example Air LLC",
        cargo_rate_per_lb: "0.475",
        invoice_tax_percent: "7.5",
        invoice_terms_days: "14",
      }),
    );
    expect(state).toEqual({ status: "saved" });
    expect(updateCompanyProfile).toHaveBeenCalledWith({
      legal_name: "Example Air LLC",
      cargo_rate_per_lb: "0.4750",
      invoice_tax_rate: "0.07500",
      invoice_terms_days: 14,
    });
  });

  it("clears a setting left blank", async () => {
    await updateCompanyAction(
      IDLE,
      form({
        cargo_rate_per_lb: "",
        invoice_tax_percent: "",
        invoice_terms_days: "",
      }),
    );
    expect(updateCompanyProfile).toHaveBeenCalledWith({
      cargo_rate_per_lb: null,
      invoice_tax_rate: null,
      invoice_terms_days: null,
    });
  });

  it("leaves alone a setting the form did not send", async () => {
    await updateCompanyAction(IDLE, form({ city: "Nome" }));
    expect(updateCompanyProfile).toHaveBeenCalledWith({ city: "Nome" });
  });

  it.each([
    ["cargo_rate_per_lb", "-0.50"],
    ["cargo_rate_per_lb", "0.47505"],
    ["invoice_tax_percent", "101"],
    ["invoice_tax_percent", "7.1255"],
    ["invoice_terms_days", "400"],
    ["invoice_terms_days", "14.5"],
  ])("refuses %s = %s on the field, before the service sees it", async (field, value) => {
    const state = await updateCompanyAction(IDLE, form({ [field]: value }));
    expect(state.status).toBe("field-errors");
    if (state.status === "field-errors") {
      expect(Object.keys(state.errors)).toEqual([field]);
    }
    expect(updateCompanyProfile).not.toHaveBeenCalled();
  });

  it("says the save failed when the service refuses it", async () => {
    updateCompanyProfile.mockRejectedValue(
      new TestApiError(403, "/auth/settings/company", "insufficient_role"),
    );
    const state = await updateCompanyAction(
      IDLE,
      form({ cargo_rate_per_lb: "0.4750" }),
    );
    expect(state).toEqual({
      status: "api-error",
      message: "Couldn't save (HTTP 403). Try again in a moment.",
    });
  });
});
