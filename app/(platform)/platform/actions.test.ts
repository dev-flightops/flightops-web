import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  createCompany: vi.fn(),
  setCompanyActive: vi.fn(),
  logoutPlatformAdmin: vi.fn(),
  loginPlatformAdmin: vi.fn(),
  changePlatformPassword: vi.fn(),
  setPlatformSession: vi.fn(),
  clearPlatformSession: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));
vi.mock("@/lib/api/platform", () => ({
  createCompany: m.createCompany,
  setCompanyActive: m.setCompanyActive,
  logoutPlatformAdmin: m.logoutPlatformAdmin,
  loginPlatformAdmin: m.loginPlatformAdmin,
  changePlatformPassword: m.changePlatformPassword,
}));
vi.mock("@/lib/api/platform-session", () => ({
  setPlatformSession: m.setPlatformSession,
  clearPlatformSession: m.clearPlatformSession,
}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

import { createCompanyAction, platformLogoutAction, setCompanyActiveAction } from "./actions";
import { platformLoginAction } from "./login/actions";
import { changePasswordAction } from "./password/actions";

const IDLE = { status: "idle" as const, attempt: 0 };
const COMPANY = "0f6c3a1e-2b4d-4e5f-8a9b-0c1d2e3f4a5b";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const company = (over: Record<string, string> = {}) =>
  form({ name: " Aurora Air ", slug: "", admin_email: " Lead@Aurora.Test ", admin_name: "Pat Lead", ...over });

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockClear();
  m.createCompany.mockReset();
  m.setCompanyActive.mockReset();
  m.loginPlatformAdmin.mockReset();
  m.changePlatformPassword.mockReset();
});

describe("creating a company (#63)", () => {
  it("sends the company and its Exec Admin, and keeps the one-time password for this page only", async () => {
    m.createCompany.mockResolvedValueOnce({
      ok: true,
      body: {
        company: { id: COMPANY, name: "Aurora Air", slug: "aurora-air", is_active: true, created_at: "", staff: 1 },
        admin_email: "lead@aurora.test",
        one_time_password: "one-time-secret",
      },
    });
    const state = await createCompanyAction(IDLE, company());
    expect(m.createCompany).toHaveBeenCalledWith({
      name: "Aurora Air",
      slug: null,
      admin_email: "lead@aurora.test",
      admin_name: "Pat Lead",
    });
    expect(state).toEqual({
      status: "ok",
      created: { name: "Aurora Air", admin_email: "lead@aurora.test", one_time_password: "one-time-secret" },
      attempt: 1,
    });
    expect(m.revalidatePath).toHaveBeenCalledWith("/platform");
  });

  it.each([
    [{ name: "A" }, "Enter the company's name."],
    [{ slug: "Bad Slug" }, "The short name takes lowercase letters, digits and hyphens."],
    [{ admin_email: "nope" }, "Enter the Exec Admin's email."],
  ])("refuses %o before asking the server, keeping what was typed", async (bad, message) => {
    const state = await createCompanyAction(IDLE, company(bad));
    expect(state).toMatchObject({ status: "error", message });
    expect(state.values?.admin_name).toBe("Pat Lead");
    expect(m.createCompany).not.toHaveBeenCalled();
  });

  it("says a taken name plainly", async () => {
    m.createCompany.mockResolvedValueOnce({ ok: false, status: 409, detail: "company_exists" });
    const state = await createCompanyAction(IDLE, company({ slug: "aurora-air" }));
    expect(state.message).toBe("A company with that name or short name already exists.");
    expect(m.createCompany.mock.calls[0][0].slug).toBe("aurora-air");
  });

  it("sends an ended session back to sign-in", async () => {
    m.createCompany.mockResolvedValueOnce({ ok: false, status: 401, detail: "signed_out" });
    await expect(createCompanyAction(IDLE, company())).rejects.toThrow("NEXT_REDIRECT:/platform/login");
    expect(m.clearPlatformSession).toHaveBeenCalled();
  });
});

describe("suspending and reactivating (#63)", () => {
  it("suspends an active company and reactivates a suspended one", async () => {
    m.setCompanyActive.mockResolvedValue({ ok: true, body: {} });
    expect(await setCompanyActiveAction(IDLE, form({ company_id: COMPANY, active: "false" }))).toEqual({
      status: "ok",
      attempt: 1,
    });
    expect(m.setCompanyActive).toHaveBeenLastCalledWith(COMPANY, false);
    await setCompanyActiveAction(IDLE, form({ company_id: COMPANY, active: "true" }));
    expect(m.setCompanyActive).toHaveBeenLastCalledWith(COMPANY, true);
  });

  it("says when the company has gone", async () => {
    m.setCompanyActive.mockResolvedValueOnce({ ok: false, status: 404, detail: "company_not_found" });
    const state = await setCompanyActiveAction(IDLE, form({ company_id: COMPANY, active: "false" }));
    expect(state).toEqual({ status: "error", message: "That company no longer exists.", attempt: 1 });
  });

  it("signs out by revoking the token and dropping the cookie", async () => {
    await expect(platformLogoutAction()).rejects.toThrow("NEXT_REDIRECT:/platform/login");
    expect(m.logoutPlatformAdmin).toHaveBeenCalled();
    expect(m.clearPlatformSession).toHaveBeenCalled();
  });
});

describe("platform sign-in (#63)", () => {
  const login = (email = "ops@platform.test", password = "pw") => form({ email, password });

  it("opens a session and the companies page", async () => {
    m.loginPlatformAdmin.mockResolvedValueOnce({
      ok: true,
      body: { access_token: "t", token_type: "bearer", expires_in: 3600, admin_id: "a", full_name: "Ops", email: "ops@platform.test" },
    });
    await expect(platformLoginAction({ status: "idle" }, login())).rejects.toThrow("NEXT_REDIRECT:/platform");
    expect(m.setPlatformSession).toHaveBeenCalledWith({
      access_token: "t",
      admin_id: "a",
      full_name: "Ops",
      email: "ops@platform.test",
      expires_in: 3600,
    });
  });

  it.each([
    [{ ok: false, status: 401, detail: "invalid_credentials" }, "Wrong email or password."],
    [{ ok: false, status: 429, detail: "too_many_attempts", retryAfter: "600" }, "Too many failed sign-in attempts. Try again in 10 minutes."],
    [{ ok: false, status: 0, detail: "fetch failed" }, "Couldn't reach the sign-in service. Try again in a moment."],
  ])("explains %o", async (result, message) => {
    m.loginPlatformAdmin.mockResolvedValueOnce(result);
    expect(await platformLoginAction({ status: "idle" }, login())).toEqual({
      status: "error",
      message,
      email: "ops@platform.test",
    });
    expect(m.setPlatformSession).not.toHaveBeenCalled();
  });
});

describe("changing the platform password (#63)", () => {
  const pw = (current: string, next: string, again = next) =>
    form({ current_password: current, new_password: next, confirm_password: again });

  it("checks length and the second copy before asking the server", async () => {
    expect((await changePasswordAction(IDLE, pw("old", "short"))).message).toBe(
      "The new password needs at least 12 characters.",
    );
    expect((await changePasswordAction(IDLE, pw("old", "long-enough-pass", "different-pass"))).message).toBe(
      "The new passwords don't match.",
    );
    expect(m.changePlatformPassword).not.toHaveBeenCalled();
  });

  it("changes it, or says the current one is wrong", async () => {
    m.changePlatformPassword.mockResolvedValueOnce({ ok: true, body: undefined });
    expect(await changePasswordAction(IDLE, pw("old-password-1", "long-enough-pass"))).toEqual({
      status: "ok",
      message: "Password changed.",
      attempt: 1,
    });
    expect(m.changePlatformPassword).toHaveBeenCalledWith("old-password-1", "long-enough-pass");
    m.changePlatformPassword.mockResolvedValueOnce({ ok: false, status: 400, detail: "current_password_incorrect" });
    expect((await changePasswordAction(IDLE, pw("wrong", "long-enough-pass"))).message).toBe(
      "Your current password is wrong.",
    );
  });
});
