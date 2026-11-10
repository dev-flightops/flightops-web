import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, getAssignment, listStaff, loadZoneTable, notFound } = vi.hoisted(() => {
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
    getAssignment: vi.fn(),
    listStaff: vi.fn(async () => ({ items: [], total: 0 })),
    loadZoneTable: vi.fn(async () => ({ fallback: "America/Anchorage" })),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/onboarding", () => ({ getAssignment }));
vi.mock("@/lib/api/auth", () => ({ listStaff, loadZoneTable }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("../task-actions", () => ({ TaskActions: () => null }));
vi.mock("./assignment-controls", () => ({ AssignmentControls: () => <div>manage controls</div> }));

import AssignmentPage from "./page";
import { assignment } from "../test-fixtures";

const params = Promise.resolve({ assignmentId: "a-1" });

beforeEach(() => vi.clearAllMocks());

describe("one hire's onboarding (#180)", () => {
  it("shows the tasks, who each falls to, and what's still required before starting", async () => {
    getAssignment.mockResolvedValueOnce(assignment());
    render(await AssignmentPage({ params }));
    expect(screen.getByRole("heading", { name: "Nina Hale" })).toBeInTheDocument();
    expect(screen.getByText(/New Hire Pilot · First Officer · hired/)).toBeInTheDocument();
    const check = screen.getByText("Background check").closest("tr")!;
    expect(within(check).getByText("HR")).toBeInTheDocument();
    expect(within(check).getByText("Overdue")).toBeInTheDocument();
    expect(within(check).getByText("Required")).toBeInTheDocument();
    expect(within(screen.getByText("Ramp tour").closest("tr")!).getByText("Supervisor: Carl Chief")).toBeInTheDocument();
    // Done the evening of 2 Nov in Alaska, though 3 Nov in UTC.
    expect(within(screen.getByText("Company email").closest("tr")!).getByText("Docs Admin, Nov 2")).toBeInTheDocument();
    expect(screen.getByText(/Still to do before Nina Hale starts: Background check/)).toBeInTheDocument();
    expect(screen.getByText(/Shown, not enforced/)).toBeInTheDocument();
    expect(screen.getByText("manage controls")).toBeInTheDocument();
  });

  it("leaves the managing out for someone with a task on it", async () => {
    getAssignment.mockResolvedValueOnce(assignment({ can_manage: false }));
    render(await AssignmentPage({ params }));
    expect(screen.queryByText("manage controls")).not.toBeInTheDocument();
    expect(listStaff).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /My Tasks/ })).toHaveAttribute("href", "/employees/onboarding/my-tasks");
  });

  it("says an archived one is left alone", async () => {
    getAssignment.mockResolvedValueOnce(assignment({ status: "archived" }));
    render(await AssignmentPage({ params }));
    expect(screen.getByText(/This onboarding is archived/)).toBeInTheDocument();
  });

  it("tells someone with nothing on it so", async () => {
    getAssignment.mockRejectedValueOnce(new TestApiError(403, "/onboarding/assignments/a-1", "no"));
    render(await AssignmentPage({ params }));
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing on this onboarding falls to you.");
  });

  it("is a 404 for one that isn't on file", async () => {
    getAssignment.mockRejectedValueOnce(new TestApiError(404, "/onboarding/assignments/a-1", "gone"));
    await expect(AssignmentPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
