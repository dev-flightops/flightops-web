import { beforeEach, describe, expect, it, vi } from "vitest";

const { loginSupplierAccount, setSupplierSession } = vi.hoisted(() => ({
  loginSupplierAccount: vi.fn(),
  setSupplierSession: vi.fn(),
}));
vi.mock("@/lib/api/supplier-auth", () => ({ loginSupplierAccount }));
vi.mock("@/lib/api/supplier-session", () => ({ setSupplierSession }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { supplierLoginAction } from "./actions";

function form(): FormData {
  const fd = new FormData();
  fd.set("email", "rep@avfuel.test");
  fd.set("password", "whatever");
  return fd;
}

beforeEach(() => loginSupplierAccount.mockReset());

describe("fuel supplier sign-in (#16)", () => {
  it("says how long to wait when the account is locked", async () => {
    loginSupplierAccount.mockResolvedValue({
      ok: false,
      status: 429,
      detail: "too_many_attempts",
      retryAfter: "600",
    });
    const state = await supplierLoginAction({ status: "idle" }, form());
    expect(state).toEqual({
      status: "api-error",
      message: "Too many failed sign-in attempts. Try again in 10 minutes.",
    });
  });

  it("still says only 'invalid' for a wrong password", async () => {
    loginSupplierAccount.mockResolvedValue({ ok: false, status: 401, detail: "invalid_credentials" });
    const state = await supplierLoginAction({ status: "idle" }, form());
    expect(state).toEqual({ status: "api-error", message: "Invalid email or password." });
  });
});
