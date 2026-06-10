import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SquawkResponse } from "@/lib/api/types";

const { TestApiError, listSquawks, listAircraft } = vi.hoisted(() => {
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
    listSquawks: vi.fn(),
    listAircraft: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ listSquawks }));
vi.mock("@/lib/api/ops", () => ({ listAircraft }));

import SquawksListPage from "./page";

function makeSquawk(
  overrides: Partial<SquawkResponse> & { id: string },
): SquawkResponse {
  return {
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208" },
    reported_at: "2026-06-15T14:00:00Z",
    reported_by: {
      id: "u-1",
      full_name: "Marie",
      email: "m@x",
    },
    title: `Squawk ${overrides.id}`,
    description: "...",
    severity: "major",
    status: "open",
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  listSquawks.mockReset();
  listAircraft.mockReset();
  listAircraft.mockResolvedValue({ items: [], total: 0 });
});

async function renderPage(
  searchParams: { status?: string; aircraft?: string } = {},
) {
  const ui = await SquawksListPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("SquawksListPage", () => {
  it("default tab 'Active' fans out two parallel calls (open + in_progress)", async () => {
    listSquawks
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(listSquawks).toHaveBeenCalledTimes(2);
    const calls = listSquawks.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "open" }),
        expect.objectContaining({ status: "in_progress" }),
      ]),
    );
  });

  it("merges + sorts active squawks newest-first", async () => {
    listSquawks
      .mockResolvedValueOnce({
        items: [
          makeSquawk({
            id: "older-open",
            title: "Older open",
            reported_at: "2026-06-10T10:00:00Z",
          }),
        ],
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [
          makeSquawk({
            id: "newer-in-progress",
            title: "Newer in progress",
            status: "in_progress",
            reported_at: "2026-06-15T18:00:00Z",
          }),
        ],
        total: 1,
      });

    const { container } = await renderPage();

    const rows = Array.from(container.querySelectorAll("tbody tr"));
    expect(rows[0]).toHaveTextContent("Newer in progress");
    expect(rows[1]).toHaveTextContent("Older open");
  });

  it("single-status tabs issue ONE backend call with the matching status", async () => {
    listSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "resolved" });

    expect(listSquawks).toHaveBeenCalledTimes(1);
    expect(listSquawks).toHaveBeenCalledWith(
      expect.objectContaining({ status: "resolved" }),
    );
  });

  it("forwards ?aircraft to the API on single-status tabs", async () => {
    listSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "open", aircraft: "ac-42" });

    expect(listSquawks).toHaveBeenCalledWith(
      expect.objectContaining({ aircraftId: "ac-42", status: "open" }),
    );
  });

  it("highlights the active filter tab", async () => {
    listSquawks.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "resolved" });

    expect(
      screen.getByRole("tab", { name: /resolved/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("renders rows with the aircraft column visible", async () => {
    listSquawks
      .mockResolvedValueOnce({
        items: [makeSquawk({ id: "s-1", title: "Hyd press low" })],
        total: 1,
      })
      .mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    const tailLink = screen.getByRole("link", { name: "N207GE" });
    expect(tailLink).toHaveAttribute(
      "href",
      "/maintenance/aircraft/ac-1",
    );
    expect(screen.getByText("Hyd press low")).toBeInTheDocument();
  });

  it("renders the error banner on 401", async () => {
    listSquawks.mockRejectedValueOnce(
      new TestApiError(401, "/maintenance/squawks", "Unauthorized"),
    );

    await renderPage();

    expect(
      screen.getByText(/session expired/i),
    ).toBeInTheDocument();
  });
});
