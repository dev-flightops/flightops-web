import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, listEnrollments, listCourses, listStaff } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, listEnrollments: vi.fn(), listCourses: vi.fn(), listStaff: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/academy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/academy")>()),
  listEnrollments,
  listCourses,
}));
vi.mock("@/lib/api/auth", () => ({ listStaff }));
vi.mock("./actions", () => ({ bulkAssignAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/academy/assignments",
}));

import AcademyAssignmentsPage from "./page";

async function renderPage() {
  return render(await AcademyAssignmentsPage({ searchParams: Promise.resolve({}) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  listEnrollments.mockResolvedValue({ items: [], total: 0 });
  listCourses.mockResolvedValue({ items: [], total: 0 });
});

describe("Academy → Assignments (#60)", () => {
  it("opens for someone the staff list refuses, instead of failing the page", async () => {
    // Until #60 the people came from the Exec Admin's user list inside
    // the same Promise.all, so a chief pilot got "You don't have
    // permission to view training assignments".
    listStaff.mockRejectedValue(new TestApiError(403, "/auth/directory", ""));
    await renderPage();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Assign Course" })).toBeInTheDocument();
  });

  it("offers the people from the staff directory", async () => {
    listStaff.mockResolvedValue({
      items: [{ id: "u-1", full_name: "Chris Chief", email: "cp@x.test", roles: ["chief_pilot"] }],
      total: 1,
    });
    await renderPage();
    await userEvent.setup().click(screen.getByRole("button", { name: "+ Assign Course" }));
    expect(screen.getByText("Chris Chief")).toBeInTheDocument();
  });
});
