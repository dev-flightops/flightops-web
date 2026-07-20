import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserResponse } from "@/lib/api/types";

const { TestApiError, listUsers, listMyTenants } = vi.hoisted(() => {
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
    listUsers: vi.fn(),
    listMyTenants: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ listUsers, listMyTenants }));

import EmployeesPage from "./page";

function makeUser(overrides: Partial<UserResponse>): UserResponse {
  return {
    id: "u-1",
    email: "u@example.com",
    full_name: "Alice Chen",
    is_active: true,
    roles: ["chief_pilot"],
    has_password: true,
    last_login_at: null,
    created_at: "2024-01-15T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  listUsers.mockReset();
  listMyTenants.mockReset();
  listMyTenants.mockResolvedValue({
    tenants: [
      {
        id: "t-1",
        name: "Peregrine Demo",
        slug: "peregrine-demo",
        plan: "demo",
        is_current: true,
      },
    ],
  });
});

async function renderPage(params: Record<string, string> = {}) {
  const page = await EmployeesPage({
    searchParams: Promise.resolve(params),
  });
  render(page);
}

describe("/employees", () => {
  it("renders the legacy table columns and active rows by default", async () => {
    listUsers.mockResolvedValue({
      items: [
        makeUser({ id: "u-1", full_name: "Alice Chen" }),
        makeUser({
          id: "u-2",
          full_name: "Terminated Bob",
          is_active: false,
        }),
      ],
      total: 2,
    });

    await renderPage();

    // Header shows the record count (Active only by default).
    expect(screen.getByRole("heading", { name: "Employees" })).toBeDefined();
    expect(screen.getByText(/^1 record$/)).toBeDefined();

    // All legacy columns present in header row.
    for (const col of [
      "Emp #",
      "Name",
      "Department",
      "Title",
      "Station",
      "Type",
      "Hire date",
      "Status",
    ]) {
      expect(screen.getByRole("columnheader", { name: col })).toBeDefined();
    }

    // Active user rendered; terminated user filtered out.
    expect(screen.getByText("Alice Chen")).toBeDefined();
    expect(screen.queryByText("Terminated Bob")).toBeNull();

    // Emp # derived from tenant slug + row index (200 base).
    expect(screen.getByText("PEREGRINE-DEMO-200")).toBeDefined();

    // Role mapped to a department label.
    expect(screen.getByText("flight_ops")).toBeDefined();

    // Status filter defaults to Active.
    expect(
      screen.getByRole("link", { name: "Active" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("terminated filter shows only inactive users + empty-state when none", async () => {
    listUsers.mockResolvedValue({
      items: [makeUser({ id: "u-1", is_active: true })],
      total: 1,
    });

    await renderPage({ status: "terminated" });

    expect(screen.getByText(/^0 records$/)).toBeDefined();
    expect(screen.getByText("No terminated employees.")).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "Terminated" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("all filter shows both active and terminated rows", async () => {
    listUsers.mockResolvedValue({
      items: [
        makeUser({ id: "u-1", full_name: "Active Alice", is_active: true }),
        makeUser({ id: "u-2", full_name: "Terminated Bob", is_active: false }),
      ],
      total: 2,
    });

    await renderPage({ status: "all" });

    expect(screen.getByText("Active Alice")).toBeDefined();
    expect(screen.getByText("Terminated Bob")).toBeDefined();
    expect(screen.getByText(/^2 records$/)).toBeDefined();
  });

  it("shows a friendly error banner on 403", async () => {
    listUsers.mockRejectedValue(
      new TestApiError(403, "/auth/settings/users", "Forbidden"),
    );

    await renderPage();

    expect(
      screen.getByText(/don't have permission to view the employee directory/),
    ).toBeDefined();
  });

  it("falls back to EMP prefix when tenant lookup fails", async () => {
    listUsers.mockResolvedValue({
      items: [makeUser({ id: "u-1" })],
      total: 1,
    });
    listMyTenants.mockRejectedValue(new Error("boom"));

    await renderPage();

    expect(screen.getByText("EMP-200")).toBeDefined();
  });
});
