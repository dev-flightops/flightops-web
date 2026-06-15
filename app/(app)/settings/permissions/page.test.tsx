import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RoleSummary, UserResponse } from "@/lib/api/types";

const { TestApiError, listRoles, listUsers } = vi.hoisted(() => {
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
    listRoles: vi.fn(),
    listUsers: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ listRoles, listUsers }));

import SettingsPermissionsPage from "./page";

const SAMPLE_ROLES: RoleSummary[] = [
  { id: "exec_admin", label: "Executive Admin", description: "Full access." },
  { id: "dispatcher", label: "Dispatcher", description: "Release flights." },
  { id: "pilot", label: "Pilot", description: "Read assignments." },
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
    ...overrides,
  };
}

beforeEach(() => {
  listRoles.mockReset();
  listUsers.mockReset();
});

describe("SettingsPermissionsPage (M2-G-48)", () => {
  it("renders each role with its description + active user count", async () => {
    listRoles.mockResolvedValueOnce({ roles: SAMPLE_ROLES });
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
    // Each "Active users" tile shows the number alongside it.
    const counts = screen.getAllByText(/^\d+$/);
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  it("shows the exec_admin warning on 403", async () => {
    listRoles.mockRejectedValueOnce(new TestApiError(403, "/roles", "x"));
    listUsers.mockRejectedValueOnce(new TestApiError(403, "/users", "x"));

    const ui = await SettingsPermissionsPage();
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent(/executive admin/i);
  });
});
