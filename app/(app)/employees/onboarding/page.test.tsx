import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssignmentSummary } from "@/lib/api/onboarding";

const { TestApiError, auth, api, listStaff } = vi.hoisted(() => {
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
    auth: vi.fn(async () => ({ roles: ["chief_pilot"] as string[] })),
    api: { listAssignments: vi.fn(), listChecklists: vi.fn(async () => []) },
    listStaff: vi.fn(async () => ({ items: [], total: 0 })),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/onboarding", () => api);
vi.mock("@/lib/api/auth", () => ({ listStaff }));
vi.mock("@/auth", () => ({ auth }));
// The form is a client component tested on its own; here only its place.
vi.mock("./assign-form", () => ({ AssignForm: () => <div>assign form</div> }));

import OnboardingPage from "./page";
import { assignment } from "./test-fixtures";

const row = (over: Partial<AssignmentSummary> = {}): AssignmentSummary => {
  const { tasks: _tasks, can_manage: _manage, ...summary } = assignment();
  return { ...summary, ...over };
};

beforeEach(() => vi.clearAllMocks());

describe("/employees/onboarding (#180)", () => {
  it("lists each hire under way with progress, overdue and what's required before starting", async () => {
    api.listAssignments.mockResolvedValueOnce([row()]);
    render(await OnboardingPage({ searchParams: Promise.resolve({}) }));
    expect(api.listAssignments).toHaveBeenCalledWith("active");
    const tr = screen.getByRole("link", { name: "Nina Hale" }).closest("tr")!;
    expect(within(tr).getByText("New Hire Pilot")).toBeInTheDocument();
    expect(within(tr).getByText("1/3 done")).toBeInTheDocument();
    expect(within(tr).getByText("1 overdue")).toBeInTheDocument();
    expect(within(tr).getByText(/1 required/i)).toBeInTheDocument();
    expect(within(tr).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByRole("link", { name: "Checklists" })).toHaveAttribute("href", "/employees/onboarding/checklists");
    expect(screen.getByText("assign form")).toBeInTheDocument();
  });

  it("has views for complete and archived onboarding", async () => {
    api.listAssignments.mockResolvedValueOnce([]);
    render(await OnboardingPage({ searchParams: Promise.resolve({ view: "archived" }) }));
    expect(api.listAssignments).toHaveBeenCalledWith("archived");
    expect(screen.getByText("Nothing archived.")).toBeInTheDocument();
  });

  it("sends anyone who doesn't run onboarding to their own tasks", async () => {
    auth.mockResolvedValueOnce({ roles: ["pilot"] });
    render(await OnboardingPage({ searchParams: Promise.resolve({}) }));
    expect(api.listAssignments).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "My Tasks" })).toHaveAttribute("href", "/employees/onboarding/my-tasks");
  });

  it("says so when it can't load", async () => {
    api.listAssignments.mockRejectedValueOnce(new TestApiError(503, "/onboarding/assignments", "down"));
    render(await OnboardingPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Onboarding is unavailable");
  });
});
