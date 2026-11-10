import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, auth, listChecklists } = vi.hoisted(() => {
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
    auth: vi.fn(async () => ({ roles: ["director_of_maintenance"] as string[] })),
    listChecklists: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/onboarding", () => ({ listChecklists }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("./new-checklist-form", () => ({
  NewChecklistForm: () => <div>create form</div>,
  DuplicateButton: ({ name }: { name: string }) => <button type="button">Duplicate {name}</button>,
}));

import ChecklistsPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("Onboarding checklists (#180)", () => {
  it("lists each checklist with its tasks and the hires it's under way for", async () => {
    listChecklists.mockResolvedValueOnce([
      {
        id: "c-1",
        name: "New Hire Pilot",
        description: "Part 135 PIC and SIC",
        target_role: "pilot",
        is_active: true,
        task_count: 12,
        in_progress_count: 2,
        created_at: "2026-11-01T00:00:00Z",
      },
    ]);
    render(await ChecklistsPage({ searchParams: Promise.resolve({}) }));
    expect(listChecklists).toHaveBeenCalledWith(false);
    const tr = screen.getByRole("link", { name: "New Hire Pilot" }).closest("tr")!;
    expect(within(tr).getByText("Pilot")).toBeInTheDocument();
    expect(within(tr).getByText("12")).toBeInTheDocument();
    expect(within(tr).getByText("2")).toBeInTheDocument();
    expect(within(tr).getByRole("button", { name: "Duplicate New Hire Pilot" })).toBeInTheDocument();
    expect(screen.getByText("create form")).toBeInTheDocument();
  });

  it("shows the archived ones when asked", async () => {
    listChecklists.mockResolvedValueOnce([]);
    render(await ChecklistsPage({ searchParams: Promise.resolve({ archived: "1" }) }));
    expect(listChecklists).toHaveBeenCalledWith(true);
  });

  it("is for whoever runs onboarding", async () => {
    auth.mockResolvedValueOnce({ roles: ["dispatcher"] });
    render(await ChecklistsPage({ searchParams: Promise.resolve({}) }));
    expect(listChecklists).not.toHaveBeenCalled();
    expect(screen.getByText(/Checklists are built by the Exec Admin/)).toBeInTheDocument();
  });
});
