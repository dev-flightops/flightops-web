import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RoleSummary, UserResponse } from "@/lib/api/types";

const {
  TestApiError,
  auth,
  listUsers,
  listRoles,
  listMyTenants,
} = vi.hoisted(() => {
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
    auth: vi.fn(),
    listUsers: vi.fn(),
    listRoles: vi.fn(),
    listMyTenants: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ listUsers, listRoles, listMyTenants }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/components/settings/users/add-user-dialog", () => ({
  AddUserDialog: () => <div data-testid="add-user-dialog" />,
}));
vi.mock("@/components/settings/users/edit-user-dialog", () => ({
  EditUserDialog: ({ user, isSelf }: { user: UserResponse; isSelf: boolean }) => (
    <div data-testid={`edit-${user.email}`} data-self={String(isSelf)} />
  ),
}));
vi.mock("@/components/settings/users/set-password-dialog", () => ({
  SetPasswordDialog: ({ email }: { email: string }) => (
    <div data-testid={`pw-${email}`} />
  ),
}));
vi.mock("@/components/settings/users/deactivate-user-button", () => ({
  DeactivateUserButton: ({ email }: { email: string }) => (
    <div data-testid={`deactivate-${email}`} />
  ),
}));

import SettingsUsersPage from "./page";

function makeUser(overrides: Partial<UserResponse>): UserResponse {
  return {
    id: "u-1",
    email: "user@example.com",
    full_name: "Some User",
    is_active: true,
    roles: ["dispatcher"],
    has_password: true,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const SAMPLE_ROLES: RoleSummary[] = [
  { id: "exec_admin", label: "Executive Admin", description: "Full access." },
  { id: "dispatcher", label: "Dispatcher", description: "Release flights." },
  { id: "pilot", label: "Pilot", description: "Read assignments." },
];

beforeEach(() => {
  listUsers.mockReset();
  listRoles.mockReset();
  listMyTenants.mockReset();
  auth.mockReset();
  auth.mockResolvedValue({ user: { id: "u-1" } });
  listRoles.mockResolvedValue({ roles: SAMPLE_ROLES });
  // Default: tenant list resolves to a single current tenant. Tests
  // that care about the subhead can override; failure-mode tests just
  // need it to not reject the Promise.all.
  listMyTenants.mockResolvedValue({
    tenants: [{ id: "t-1", name: "Test Tenant", is_current: true }],
  });
});

describe("SettingsUsersPage (M2-G-48)", () => {
  it("lists active users with role chips and marks self with a 'You' badge", async () => {
    listUsers.mockResolvedValueOnce({
      items: [
        makeUser({ id: "u-1", email: "me@x.com", full_name: "Me" }),
        makeUser({
          id: "u-2",
          email: "other@x.com",
          full_name: "Other",
          roles: ["pilot", "ground_ops"],
        }),
      ],
      total: 2,
    });

    const ui = await SettingsUsersPage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: /^user management$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Me")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    // 'You' badge only on the caller's own row
    expect(screen.getByText("You")).toBeInTheDocument();
    // Role chips show display labels from the catalog
    expect(screen.getByText("Dispatcher")).toBeInTheDocument();
    expect(screen.getByText("Pilot")).toBeInTheDocument();
  });

  it("renders the empty state when no users exist", async () => {
    listUsers.mockResolvedValueOnce({ items: [], total: 0 });

    const ui = await SettingsUsersPage();
    render(ui);

    expect(screen.getByText(/no users yet/i)).toBeInTheDocument();
  });

  it("separates inactive users into their own muted section", async () => {
    listUsers.mockResolvedValueOnce({
      items: [
        makeUser({ id: "u-1", email: "a@x.com" }),
        makeUser({
          id: "u-2",
          email: "deactivated@x.com",
          is_active: false,
        }),
      ],
      total: 2,
    });

    const ui = await SettingsUsersPage();
    render(ui);

    expect(screen.getByText(/inactive \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("deactivated@x.com")).toBeInTheDocument();
  });

  it("flags invite-pending users", async () => {
    listUsers.mockResolvedValueOnce({
      items: [
        makeUser({
          id: "u-9",
          email: "pending@x.com",
          has_password: false,
        }),
      ],
      total: 1,
    });

    const ui = await SettingsUsersPage();
    render(ui);

    expect(screen.getByText(/invite pending/i)).toBeInTheDocument();
  });

  it("shows an exec_admin warning on 403", async () => {
    listUsers.mockRejectedValueOnce(new TestApiError(403, "/users", "x"));

    const ui = await SettingsUsersPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /executive admin/i,
    );
  });

  it("shows session-expired text on 401", async () => {
    listUsers.mockRejectedValueOnce(new TestApiError(401, "/users", "x"));

    const ui = await SettingsUsersPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });
});
