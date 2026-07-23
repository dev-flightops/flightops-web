import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAccessRoleRow, UserResponse } from "@/lib/api/types";

const { TestApiError, listAdminAccess, listUsers, setAdminAccess } = vi.hoisted(
  () => {
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
      listAdminAccess: vi.fn(),
      listUsers: vi.fn(),
      setAdminAccess: vi.fn(),
    };
  },
);

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({
  listAdminAccess,
  listUsers,
  setAdminAccess,
}));

import SettingsPermissionsPage from "./page";

const SAMPLE_ROLES: AdminAccessRoleRow[] = [
  {
    id: "exec_admin",
    label: "Executive Admin",
    description: "Full access.",
    admin_access: true,
  },
  {
    id: "dispatcher",
    label: "Dispatcher",
    description: "Release flights.",
    admin_access: false,
  },
  {
    id: "pilot",
    label: "Pilot",
    description: "Read assignments.",
    admin_access: false,
  },
];

function makeUser(overrides: Partial<UserResponse>): UserResponse {
  return {
    id: "u-1",
    email: "u@x.com",
    full_name: "U",
    is_active: true,
    roles: [],
    has_password: true,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00Z",
    emp_number: null,
    title: null,
    station: null,
    employment_type: null,
    hire_date: null,
    termination_date: null,
    ...overrides,
  };
}

beforeEach(() => {
  listAdminAccess.mockReset();
  listUsers.mockReset();
  setAdminAccess.mockReset();
});

describe("SettingsPermissionsPage (M2-G-48 + M2-X-1)", () => {
  it("renders each role with its description + active user count", async () => {
    listAdminAccess.mockResolvedValueOnce({ roles: SAMPLE_ROLES });
    listUsers.mockResolvedValueOnce({
      items: [
        makeUser({ id: "u-1", roles: ["exec_admin", "dispatcher"] }),
        makeUser({ id: "u-2", roles: ["dispatcher"] }),
        makeUser({
          id: "u-3",
          roles: ["pilot"],
          is_active: false, // should NOT count
        }),
      ],
      total: 3,
    });

    const ui = await SettingsPermissionsPage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: /^permissions$/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Executive Admin")).toBeInTheDocument();
    expect(screen.getByText("Dispatcher")).toBeInTheDocument();
    // Counts: exec_admin=1, dispatcher=2, pilot=0 (inactive user excluded)
    expect(screen.getByText(/^1 active user$/i)).toBeInTheDocument();
    expect(screen.getByText(/^2 active users$/i)).toBeInTheDocument();
  });

  it("renders an Admin Access toggle for every role", async () => {
    listAdminAccess.mockResolvedValueOnce({ roles: SAMPLE_ROLES });
    listUsers.mockResolvedValueOnce({ items: [], total: 0 });

    const ui = await SettingsPermissionsPage();
    render(ui);

    const toggles = screen.getAllByRole("checkbox");
    expect(toggles).toHaveLength(SAMPLE_ROLES.length);
    // exec_admin is locked on; dispatcher + pilot start unchecked.
    expect(
      screen.getByLabelText("Admin Access for exec_admin"),
    ).toBeChecked();
    expect(
      screen.getByLabelText("Admin Access for exec_admin"),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("Admin Access for dispatcher"),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("Admin Access for pilot"),
    ).not.toBeChecked();
  });

  it("shows the exec_admin warning on 403", async () => {
    listAdminAccess.mockRejectedValueOnce(
      new TestApiError(403, "/admin-access", "x"),
    );
    listUsers.mockRejectedValueOnce(new TestApiError(403, "/users", "x"));

    const ui = await SettingsPermissionsPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/executive admin/i);
  });
});
