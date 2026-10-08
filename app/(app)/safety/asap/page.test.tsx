import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, getAsapHub, listDocuments } = vi.hoisted(() => ({
  auth: vi.fn(),
  getAsapHub: vi.fn(),
  listDocuments: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {}, apiFetch: vi.fn() }));
vi.mock("@/lib/api/asap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/asap")>()),
  getAsapHub,
}));
vi.mock("@/lib/api/documents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/documents")>()),
  listDocuments,
}));
vi.mock("./actions", () => ({ saveAsapReviewAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import AsapHubPage from "./page";

function report(id: string, title: string) {
  return {
    id,
    report_type: "asap",
    title,
    description: "Levelled at 9,000 instead of 8,000 after a readback error.",
    occurred_on: "2026-10-05",
    flight_number: "PGR101",
    aircraft_tail: "N208PF",
    is_anonymous: false,
    reporter: { id: "u-1", full_name: "Alice Chen", email: "a@x.test" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ roles: ["safety_officer"], user: { id: "so-1" } });
  listDocuments.mockResolvedValue({ items: [], categories: [] });
  getAsapHub.mockResolvedValue({
    items: [
      { report: report("r-2", "Altitude deviation on climb out"), review: null },
      {
        report: report("r-1", "Wrong runway lined up"),
        review: {
          review_date: "2026-10-06",
          erc_participants: "Company, FAA and union reps",
          decision: "accepted",
          decision_rationale: "Sole source.",
          corrective_action_summary: null,
          de_identified: true,
          reviewed_by: { id: "so-1", full_name: "Lucia Ferreira", email: "so@x.test" },
          closed_date: "2026-10-06",
          updated_at: "2026-10-06T20:00:00Z",
        },
      },
    ],
    counts: { pending: 1, accepted: 1, accepted_ns: 0, excluded: 0, withdrawn: 0 },
  });
});

describe("ASAP hub (#59)", () => {
  it("is not the chief pilot's: they go to the safety reports", async () => {
    auth.mockResolvedValue({ roles: ["chief_pilot"], user: { id: "cp-1" } });
    await expect(AsapHubPage()).rejects.toThrow("NEXT_REDIRECT /safety/reports");
  });

  it("counts each decision, a report nobody reviewed as pending", async () => {
    render(await AsapHubPage());
    expect(screen.getByText("Pending").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("Accepted (Sole)").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("Excluded").previousSibling).toHaveTextContent("0");
  });

  it("shows each report with its review, and a form to file or update it", async () => {
    render(await AsapHubPage());
    const reviewed = screen.getByRole("link", { name: "Wrong runway lined up" }).closest("article")!;
    const badge = within(reviewed)
      .getAllByText("Accepted — Sole Source")
      .filter((el) => el.tagName !== "OPTION");
    expect(badge).toHaveLength(1);
    expect(within(reviewed).getByText(/ERC Review — Oct 06, 2026/)).toBeInTheDocument();
    expect(within(reviewed).getByText("✓ De-identified before sharing")).toBeInTheDocument();
    expect(within(reviewed).getByText("Update review")).toBeInTheDocument();
    const fresh = screen.getByRole("link", { name: "Altitude deviation on climb out" }).closest("article")!;
    expect(
      within(fresh)
        .getAllByText("Pending Review")
        .filter((el) => el.tagName !== "OPTION"),
    ).toHaveLength(1);
    expect(within(fresh).getByText("File ERC review")).toBeInTheDocument();
  });

  it("asks for the MOU in the library when none is on file", async () => {
    render(await AsapHubPage());
    expect(listDocuments).toHaveBeenCalledWith({ category: "ASAP MOU" });
    expect(screen.getByText(/No MOU on file/)).toBeInTheDocument();
  });
});
