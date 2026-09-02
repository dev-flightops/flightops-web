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

import EmployeesPage, { formatHireDate } from "./page";

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

  it("populates real employee columns from the backend when set", async () => {
    listUsers.mockResolvedValue({
      items: [
        makeUser({
          id: "u-1",
          full_name: "Mark Chiklak",
          emp_number: "PGRN-203",
          title: "A&P",
          station: "BET",
          employment_type: "full_time",
          hire_date: "2024-01-15",
        }),
      ],
      total: 1,
    });

    await renderPage();

    // Real emp_number wins over the derived fallback.
    expect(screen.getByText("PGRN-203")).toBeDefined();
    expect(screen.queryByText("PEREGRINE-DEMO-200")).toBeNull();
    expect(screen.getByText("A&P")).toBeDefined();
    expect(screen.getByText("BET")).toBeDefined();
    expect(screen.getByText("Full Time")).toBeDefined();
  });

  it("shows 'Inactive' when is_active=false but no termination_date is set", async () => {
    listUsers.mockResolvedValue({
      items: [
        makeUser({
          id: "u-1",
          full_name: "Leave Larry",
          is_active: false,
          termination_date: null,
        }),
      ],
      total: 1,
    });

    await renderPage({ status: "all" });

    // Row status badge shows Inactive. The "Terminated" filter chip is
    // always in the DOM as a link, so scope the row-status assertion to
    // <span> only.
    const badge = screen
      .getAllByText("Inactive")
      .find((el) => el.tagName === "SPAN");
    expect(badge).toBeDefined();
    const terminatedSpan = screen
      .queryAllByText("Terminated")
      .find((el) => el.tagName === "SPAN");
    expect(terminatedSpan).toBeUndefined();
  });

  it("shows 'Terminated' when is_active=false AND termination_date is set", async () => {
    listUsers.mockResolvedValue({
      items: [
        makeUser({
          id: "u-1",
          full_name: "Left Bob",
          is_active: false,
          termination_date: "2026-06-30",
        }),
      ],
      total: 1,
    });

    await renderPage({ status: "all" });

    // Row-status badge only (filter chip is a link, not a span).
    const badge = screen
      .getAllByText("Terminated")
      .find((el) => el.tagName === "SPAN");
    expect(badge).toBeDefined();
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

/**
 * The hire-date column reads from two sources — `hire_date`, a plain
 * calendar day, and `created_at`, a real instant — and renders both in
 * one column. They have to land on the same day for every reader.
 */

function inZone<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = previous;
  }
}

// Tokyo is +9, Anchorage -8. A calendar day parsed in the host zone
// breaks going east; a UTC instant formatted in the host zone breaks
// going west. Running only in UTC, as CI does, hides both.
const ZONES = ["UTC", "Asia/Tokyo", "America/Anchorage"];

describe("formatHireDate", () => {
  it("renders a plain calendar day as that day, in every zone", () => {
    for (const tz of ZONES) {
      expect(
        inZone(tz, () => formatHireDate("2026-08-15")),
        `hire_date shifted under TZ=${tz}`,
      ).toBe("Aug 15, 2026");
    }
  });

  it("holds at the start of a month, where a shift changes the month too", () => {
    for (const tz of ZONES) {
      expect(
        inZone(tz, () => formatHireDate("2026-08-01")),
        `hire_date shifted under TZ=${tz}`,
      ).toBe("Aug 1, 2026");
    }
  });

  it("renders the created_at fallback in UTC, in every zone", () => {
    // 23:00Z rolls forward in Tokyo, 02:00Z rolls back in Anchorage. A
    // midday instant lands on the same day everywhere and proves nothing.
    for (const [tz, iso] of [
      ["UTC", "2026-08-15T12:00:00Z"],
      ["Asia/Tokyo", "2026-08-15T23:00:00Z"],
      ["America/Anchorage", "2026-08-15T02:00:00Z"],
    ] as const) {
      expect(
        inZone(tz, () => formatHireDate(iso)),
        `created_at shifted under TZ=${tz}`,
      ).toBe("Aug 15, 2026");
    }
  });

  it("returns the raw value rather than printing Invalid Date", () => {
    expect(formatHireDate("not-a-date")).toBe("not-a-date");
    expect(formatHireDate("")).toBe("");
  });
});
