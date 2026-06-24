import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMelItems, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { listMelItems: vi.fn(), TestApiError };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ listMelItems }));
// next/navigation hooks aren't needed in JSDOM for the server-side
// OpenMelPanel render, but MelAckList (a child) imports useRouter +
// useSearchParams. Mock both so the child renders cleanly when the
// panel hands off to it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { OpenMelPanel } from "./open-mel-panel";
import type { MelItemResponse } from "@/lib/api/types";

function makeMel(over: Partial<MelItemResponse> & { id: string }): MelItemResponse {
  return {
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208" },
    ata_chapter: "25-10",
    description: "Passenger cabin door light inop.",
    category: "C",
    deferred_at: "2026-06-01T12:00:00Z",
    due_at: "2026-07-01T00:00:00Z",
    status: "open",
    closed_at: null,
    closed_by: null,
    notes: null,
    ...over,
  };
}

async function renderPanel(
  ackedMelIds: string[] = [],
  aircraftId = "ac-1",
) {
  const ui = await OpenMelPanel({ aircraftId, ackedMelIds });
  return render(ui);
}

beforeEach(() => {
  listMelItems.mockReset();
});

describe("OpenMelPanel", () => {
  it("queries listMelItems with status=open for the given aircraft", async () => {
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPanel([], "ac-42");

    expect(listMelItems).toHaveBeenCalledWith(
      expect.objectContaining({ aircraftId: "ac-42", status: "open" }),
    );
  });

  it("renders the 'no open MELs' empty state when the list is empty", async () => {
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPanel();

    expect(screen.getByText(/no open mels/i)).toBeInTheDocument();
  });

  it("hands off to MelAckList with the items + counter when items exist", async () => {
    listMelItems.mockResolvedValueOnce({
      items: [
        makeMel({ id: "m-1" }),
        makeMel({
          id: "m-2",
          ata_chapter: "32-40",
          description: "Brake wear pin near limit.",
          category: "B",
        }),
      ],
      total: 2,
    });

    await renderPanel(["m-1"]);

    // Counter + descriptions visible.
    expect(screen.getByText(/1 of 2 acknowledged/i)).toBeInTheDocument();
    expect(
      screen.getByText(/passenger cabin door light/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/brake wear pin/i)).toBeInTheDocument();
  });

  it("'all acknowledged' badge appears when every item is checked", async () => {
    listMelItems.mockResolvedValueOnce({
      items: [makeMel({ id: "m-1" })],
      total: 1,
    });

    await renderPanel(["m-1"]);

    expect(screen.getByText(/1 of 1 acknowledged/i)).toBeInTheDocument();
    // The Cat-A "ack required" hint should NOT be shown when fully acked.
    expect(
      screen.queryByText(/each mel needs dispatcher acknowledgment/i),
    ).not.toBeInTheDocument();
  });

  it("renders the friendly 'sign in' error on 401", async () => {
    listMelItems.mockRejectedValueOnce(
      new TestApiError(401, "/maintenance/mel-items", "Unauthorized"),
    );

    await renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
  });

  it("falls back to the generic 'unavailable' error on other failures", async () => {
    listMelItems.mockRejectedValueOnce(
      new TestApiError(502, "/maintenance/mel-items", "Bad Gateway"),
    );

    await renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });
});
