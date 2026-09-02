import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserResponse } from "@/lib/api/types";

/**
 * /payroll/new — the shell around the create form.
 *
 * The page itself owns one decision: which employees are offered. A
 * terminated employee left in that list is how a pay event gets recorded
 * against someone who no longer works here, so the filter is the thing
 * worth pinning.
 */

const { TestApiError, listUsers, formProps } = vi.hoisted(() => {
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
    formProps: { current: null as { employees: UserResponse[] } | null },
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/auth", () => ({ listUsers }));
// useActionState form — stubbed, but it records what it was handed so the
// filtering above it stays observable.
vi.mock("./new-pay-event-form", () => ({
  NewPayEventForm: (props: { employees: UserResponse[] }) => {
    formProps.current = props;
    return <div data-testid="pay-event-form" />;
  },
}));

import NewPayEventPage from "./page";

function user(over: Partial<UserResponse> & { id: string }): UserResponse {
  return {
    email: `${over.id}@peregrine.local`,
    full_name: "Alice Chen",
    is_active: true,
    roles: ["PILOT"],
    has_password: true,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00Z",
    emp_number: null,
    title: null,
    station: null,
    employment_type: null,
    hire_date: null,
    termination_date: null,
    ...over,
  } as UserResponse;
}

const renderPage = async () => render(await NewPayEventPage());

beforeEach(() => {
  listUsers.mockReset();
  formProps.current = null;
  listUsers.mockResolvedValue({ items: [], total: 0 });
});

describe("employee list", () => {
  it("offers only active employees", async () => {
    listUsers.mockResolvedValueOnce({
      items: [
        user({ id: "u-1", full_name: "Alice Chen", is_active: true }),
        user({ id: "u-2", full_name: "Departed Person", is_active: false }),
        user({ id: "u-3", full_name: "Bob Henderson", is_active: true }),
      ],
      total: 3,
    });
    await renderPage();
    const names = formProps.current!.employees.map((e) => e.full_name);
    expect(names).toEqual(["Alice Chen", "Bob Henderson"]);
  });

  it("hands the form an empty list rather than undefined when nobody is active", async () => {
    // The form maps over this prop; undefined would throw during render.
    listUsers.mockResolvedValueOnce({
      items: [user({ id: "u-1", is_active: false })],
      total: 1,
    });
    await renderPage();
    expect(formProps.current!.employees).toEqual([]);
    expect(screen.getByTestId("pay-event-form")).toBeInTheDocument();
  });
});

describe("load failures", () => {
  it("asks the user to sign in again on 401", async () => {
    listUsers.mockRejectedValueOnce(
      new TestApiError(401, "/auth/users", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });

  it("reports any other failure as the list being unavailable", async () => {
    listUsers.mockRejectedValueOnce(
      new TestApiError(500, "/auth/users", "nope"),
    );
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("treats a non-API failure the same way", async () => {
    listUsers.mockRejectedValueOnce(new Error("socket hang up"));
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("withholds the form when the employee list failed to load", async () => {
    // A form with no selectable employee cannot produce a valid event,
    // and submitting one would 422 with nothing the user can fix.
    listUsers.mockRejectedValueOnce(
      new TestApiError(500, "/auth/users", "nope"),
    );
    await renderPage();
    expect(screen.queryByTestId("pay-event-form")).not.toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("links back to the events list", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: "Pay Events" })).toHaveAttribute(
      "href",
      "/payroll",
    );
  });
});
