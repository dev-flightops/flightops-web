import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  session: vi.fn(),
  clear: vi.fn(),
  list: vi.fn(),
  actionState: { current: undefined as unknown },
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));
// Tests run React 18, which has no useActionState: stand it in.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [m.actionState.current ?? initial, () => {}, false],
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/api/platform-session", () => ({ getPlatformSession: m.session, clearPlatformSession: m.clear }));
vi.mock("@/lib/api/platform", () => ({ listCompanies: m.list }));
vi.mock("./actions", () => ({
  createCompanyAction: vi.fn(),
  setCompanyActiveAction: vi.fn(),
  platformLogoutAction: vi.fn(),
}));

import PlatformCompaniesPage from "./page";
import { CreateCompanyForm } from "./create-company-form";

const SESSION = { access_token: "t", admin_id: "a", full_name: "Platform Ops", email: "ops@platform.test", expires_at: 0 };

function company(over: Record<string, unknown>) {
  return { id: "c-1", name: "Aurora Air", slug: "aurora-air", is_active: true, created_at: "2026-10-09T10:00:00Z", staff: 4, ...over };
}

beforeEach(() => {
  m.session.mockReset().mockResolvedValue(SESSION);
  m.list.mockReset();
  m.clear.mockClear();
  m.actionState.current = undefined;
});

describe("the companies page (#63)", () => {
  it("lists every company with its status and the action that fits it", async () => {
    m.list.mockResolvedValue({
      ok: true,
      body: { items: [company({}), company({ id: "c-2", name: "Borealis", slug: "borealis", is_active: false, staff: 2 })] },
    });
    render(await PlatformCompaniesPage());
    expect(screen.getByRole("heading", { name: "Companies" })).toBeTruthy();
    expect(screen.getByText("Platform Ops")).toBeTruthy();
    const aurora = screen.getByText("Aurora Air").closest("tr") as HTMLElement;
    expect(within(aurora).getByText("Active")).toBeTruthy();
    expect(within(aurora).getByRole("button", { name: "Suspend" })).toBeTruthy();
    const borealis = screen.getByText("Borealis").closest("tr") as HTMLElement;
    expect(within(borealis).getByText("Suspended")).toBeTruthy();
    expect(within(borealis).getByRole("button", { name: "Reactivate" })).toBeTruthy();
  });

  it("sends anyone without a platform session to the platform sign-in", async () => {
    m.session.mockResolvedValue(null);
    await expect(PlatformCompaniesPage()).rejects.toThrow("NEXT_REDIRECT:/platform/login");
    expect(m.list).not.toHaveBeenCalled();
  });

  it("drops an ended session and sends it to sign in again", async () => {
    m.list.mockResolvedValue({ ok: false, status: 401, detail: "invalid_token" });
    await expect(PlatformCompaniesPage()).rejects.toThrow("NEXT_REDIRECT:/platform/login");
    expect(m.clear).toHaveBeenCalled();
  });
});

describe("the create form (#63)", () => {
  it("shows the new Exec Admin's one-time password once it is made", () => {
    m.actionState.current = {
      status: "ok",
      created: { name: "Aurora Air", admin_email: "lead@aurora.test", one_time_password: "one-time-secret" },
      attempt: 1,
    };
    render(<CreateCompanyForm />);
    const shown = screen.getByRole("status");
    expect(shown.textContent).toContain("Aurora Air is set up.");
    expect(shown.textContent).toContain("lead@aurora.test");
    expect(shown.textContent).toContain("one-time-secret");
    expect(shown.textContent).toContain("Shown once.");
  });

  it("shows a refusal with the company as typed", () => {
    m.actionState.current = {
      status: "error",
      message: "A company with that name or short name already exists.",
      values: { name: "Aurora Air", slug: "", admin_email: "lead@aurora.test", admin_name: "Pat Lead" },
      attempt: 1,
    };
    render(<CreateCompanyForm />);
    expect(screen.getByRole("alert").textContent).toBe("A company with that name or short name already exists.");
    expect((screen.getByLabelText("Company Name *") as HTMLInputElement).value).toBe("Aurora Air");
  });
});
