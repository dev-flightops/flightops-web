import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AircraftListItem,
  MelItemResponse,
} from "@/lib/api/types";

const { TestApiError, listMelItems, listAircraft } = vi.hoisted(() => {
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
    listMelItems: vi.fn(),
    listAircraft: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ listMelItems }));
vi.mock("@/lib/api/ops", () => ({ listAircraft }));

import MelListPage from "./page";

function makeMel(
  overrides: Partial<MelItemResponse> & { id: string },
): MelItemResponse {
  return {
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208" },
    ata_chapter: "21-30",
    description: `MEL ${overrides.id}`,
    category: "C",
    deferred_at: "2026-06-01T00:00:00Z",
    due_at: "2026-08-01T00:00:00Z",
    status: "open",
    closed_at: null,
    closed_by: null,
    notes: null,
    ...overrides,
  };
}

function makeAircraft(overrides: Partial<AircraftListItem> & { id: string }): AircraftListItem {
  return {
    tail_number: "N207GE",
    model: "Cessna 208",
    seats: 9,
    max_payload_lbs: 3000,
    is_active: true,
    ...overrides,
  };
}

beforeEach(() => {
  listMelItems.mockReset();
  listAircraft.mockReset();
  listAircraft.mockResolvedValue({ items: [], total: 0 });
});

async function renderPage(
  searchParams: { status?: string; aircraft?: string } = {},
) {
  const ui = await MelListPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

describe("MelListPage", () => {
  it("defaults to status=open and no aircraft filter", async () => {
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(listMelItems).toHaveBeenCalledWith({
      status: "open",
      aircraftId: undefined,
      limit: 200,
    });
  });

  it("forwards the ?status and ?aircraft params to the API", async () => {
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });
    listAircraft.mockResolvedValueOnce({
      items: [makeAircraft({ id: "ac-42" })],
      total: 1,
    });

    await renderPage({ status: "closed", aircraft: "ac-42" });

    expect(listMelItems).toHaveBeenCalledWith({
      status: "closed",
      aircraftId: "ac-42",
      limit: 200,
    });
  });

  it("falls back to status=open when ?status is bogus", async () => {
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "bogus" });

    expect(listMelItems).toHaveBeenCalledWith({
      status: "open",
      aircraftId: undefined,
      limit: 200,
    });
  });

  it("highlights the active status tab", async () => {
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "closed" });

    expect(screen.getByRole("tab", { name: /closed/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /open/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("renders rows with the aircraft column visible", async () => {
    listMelItems.mockResolvedValueOnce({
      items: [
        makeMel({
          id: "MEL-A",
          aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208" },
        }),
        makeMel({
          id: "MEL-B",
          aircraft: { id: "ac-2", tail_number: "N510PA", model: "PC-12" },
        }),
      ],
      total: 2,
    });

    await renderPage();

    // Aircraft column cells link to the per-aircraft detail page.
    const tailLink = screen.getByRole("link", { name: "N207GE" });
    expect(tailLink).toHaveAttribute("href", "/maintenance/aircraft/ac-1");
    expect(screen.getByText("N510PA")).toBeInTheDocument();
    expect(screen.getByText(/MEL MEL-A/)).toBeInTheDocument();
  });

  it("renders the closed-filter empty message when no rows match", async () => {
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage({ status: "closed" });

    expect(
      screen.getByText(/no closed mel items match/i),
    ).toBeInTheDocument();
  });

  it("renders the error banner on 401", async () => {
    listMelItems.mockRejectedValueOnce(
      new TestApiError(401, "/maintenance/mel-items", "Unauthorized"),
    );

    await renderPage();

    expect(
      screen.getByText(/session expired/i),
    ).toBeInTheDocument();
  });
});
