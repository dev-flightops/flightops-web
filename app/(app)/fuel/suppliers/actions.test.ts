import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, addSupplierLogin, setSupplierLoginActive, setSupplierLoginPassword } = vi.hoisted(() => {
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
    addSupplierLogin: vi.fn(),
    setSupplierLoginActive: vi.fn(),
    setSupplierLoginPassword: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ addSupplierLogin, setSupplierLoginActive, setSupplierLoginPassword }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addSupplierLoginAction, setSupplierLoginPasswordAction } from "./actions";

const LOGIN = {
  id: "b-1",
  account_id: "acc-1",
  full_name: "Glen Mattson",
  email: "glen@tundrafuel.test",
  is_active: true,
  last_login_at: null,
  serves_others: false,
};

beforeEach(() => vi.clearAllMocks());

describe("addSupplierLoginAction (#134)", () => {
  it("tells them how the rep signs in", async () => {
    addSupplierLogin.mockResolvedValueOnce({ ...LOGIN, existing_account: false });
    const result = await addSupplierLoginAction("s-1", {
      full_name: " Glen Mattson ",
      email: "glen@tundrafuel.test",
      password: "tundra-pass-1",
    });
    expect(addSupplierLogin).toHaveBeenCalledWith("s-1", {
      full_name: "Glen Mattson",
      email: "glen@tundrafuel.test",
      password: "tundra-pass-1",
    });
    expect(result).toEqual({
      ok: true,
      message: "Glen Mattson can sign in at /fuel-supplier/login with glen@tundrafuel.test and that password.",
    });
  });

  it("says when the rep keeps their own password", async () => {
    addSupplierLogin.mockResolvedValueOnce({ ...LOGIN, serves_others: true, existing_account: true });
    const result = await addSupplierLoginAction("s-1", { full_name: "Glen", email: "glen@tundrafuel.test", password: "" });
    expect(addSupplierLogin).toHaveBeenCalledWith("s-1", expect.objectContaining({ password: null }));
    expect(result.message).toMatch(/already had a supplier login: they sign in .* with their own password/);
  });

  it("passes on the service's reason, and who may do it", async () => {
    addSupplierLogin.mockRejectedValueOnce(
      new TestApiError(
        409,
        "/auth/settings/fuel-suppliers/s-1/logins",
        JSON.stringify({ detail: { error: "already_has_login", message: "glen@tundrafuel.test already signs in for this supplier." } }),
      ),
    );
    expect(await addSupplierLoginAction("s-1", { full_name: "Glen", email: "glen@tundrafuel.test", password: "tundra-pass-1" })).toEqual({
      ok: false,
      error: "glen@tundrafuel.test already signs in for this supplier.",
    });
    addSupplierLogin.mockRejectedValueOnce(new TestApiError(403, "/auth/settings/fuel-suppliers/s-1/logins", "insufficient_role"));
    const refused = await addSupplierLoginAction("s-1", { full_name: "Glen", email: "glen@tundrafuel.test", password: "tundra-pass-1" });
    expect(refused.error).toMatch(/^Only the Chief Pilot/);
  });

  it("refuses a short password before asking", async () => {
    const result = await addSupplierLoginAction("s-1", { full_name: "Glen", email: "glen@tundrafuel.test", password: "short" });
    expect(result).toEqual({ ok: false, error: "The password needs at least 8 characters." });
    expect(addSupplierLogin).not.toHaveBeenCalled();
    expect(await setSupplierLoginPasswordAction("s-1", "b-1", "short")).toEqual({
      ok: false,
      error: "The password needs at least 8 characters.",
    });
    expect(setSupplierLoginPassword).not.toHaveBeenCalled();
  });
});
