import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, auth, listMyOnboardingTasks } = vi.hoisted(() => {
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
    auth: vi.fn(async () => ({ roles: ["pilot"] as string[] })),
    listMyOnboardingTasks: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/onboarding", () => ({ listMyOnboardingTasks }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("../task-actions", () => ({ TaskActions: () => <span>task actions</span> }));

import MyOnboardingTasksPage from "./page";
import { myTask } from "../test-fixtures";

beforeEach(() => vi.clearAllMocks());

describe("My onboarding tasks (#180)", () => {
  it("lists what falls to the reader, with the hire it's for", async () => {
    listMyOnboardingTasks.mockResolvedValueOnce({
      items: [myTask({ name: "Upload pilot certificate", overdue: true, required_before_start: true, task_type: "document_upload" })],
    });
    render(await MyOnboardingTasksPage());
    const tr = screen.getByText("Upload pilot certificate").closest("tr")!;
    expect(within(tr).getByRole("link", { name: "Nina Hale" })).toHaveAttribute("href", "/employees/onboarding/a-1");
    expect(within(tr).getByText("New Hire Pilot")).toBeInTheDocument();
    expect(within(tr).getByText("Overdue")).toBeInTheDocument();
    expect(within(tr).getByText("Required")).toBeInTheDocument();
    expect(within(tr).getByText("Document Upload")).toBeInTheDocument();
    expect(within(tr).getByText("task actions")).toBeInTheDocument();
    // A pilot goes back Home; there's no onboarding list for them.
    expect(screen.getByRole("link", { name: /Home/ })).toHaveAttribute("href", "/home");
  });

  it("says when nothing falls to the reader", async () => {
    listMyOnboardingTasks.mockResolvedValueOnce({ items: [] });
    render(await MyOnboardingTasksPage());
    expect(screen.getByText("Nothing on anyone's onboarding falls to you.")).toBeInTheDocument();
  });

  it("links whoever runs onboarding to all of it", async () => {
    auth.mockResolvedValueOnce({ roles: ["safety_officer"] });
    listMyOnboardingTasks.mockResolvedValueOnce({ items: [] });
    render(await MyOnboardingTasksPage());
    expect(screen.getByRole("link", { name: "All Onboarding" })).toHaveAttribute("href", "/employees/onboarding");
  });
});
