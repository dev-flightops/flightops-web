import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, listStaff } = vi.hoisted(() => ({ auth: vi.fn(), listStaff: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/auth", () => ({ listStaff }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("./actions", () => ({ openCapaAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
// Next runs the form on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import OpenCapaPage from "./page";

const REPORT = "8f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ roles: ["safety_officer"], user: { id: "so-1" } });
});

describe("Open a CAPA (#60)", () => {
  it("offers the Safety Officer every active staff member as owner", async () => {
    listStaff.mockResolvedValue({
      items: [
        { id: "u-1", full_name: "Lucia Ferreira", email: "so@x.test", roles: ["safety_officer"] },
        { id: "u-2", full_name: "Samuel Pike", email: "ramp@x.test", roles: ["ground_ops"] },
      ],
      total: 2,
    });
    render(
      await OpenCapaPage({
        searchParams: Promise.resolve({ source_type: "safety_report", source_id: REPORT }),
      }),
    );
    expect(screen.getByRole("option", { name: /Samuel Pike/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Lucia Ferreira/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to safety report/i })).toHaveAttribute(
      "href",
      `/safety/reports/${REPORT}`,
    );
  });
});
