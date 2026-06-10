import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MelItemResponse } from "@/lib/api/types";

import { MelTable } from "./mel-table";

function makeMel(
  overrides: Partial<MelItemResponse> & { id: string },
): MelItemResponse {
  return {
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208" },
    ata_chapter: "21-30",
    description: "Cabin pressurization controller intermittent",
    category: "C",
    deferred_at: "2026-06-01T00:00:00Z",
    due_at: "2026-07-01T00:00:00Z",
    status: "open",
    closed_at: null,
    closed_by: null,
    notes: null,
    ...overrides,
  };
}

describe("MelTable", () => {
  it("renders the empty-state copy when there are no items", () => {
    render(<MelTable items={[]} />);
    expect(screen.getByText(/no open mel items/i)).toBeInTheDocument();
  });

  it("renders ATA / description / category for each row", () => {
    render(
      <MelTable
        items={[
          makeMel({
            id: "mel-1",
            ata_chapter: "34-10",
            description: "Pitot heat element",
            category: "B",
          }),
        ]}
      />,
    );

    expect(screen.getByText("34-10")).toBeInTheDocument();
    expect(screen.getByText("Pitot heat element")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("marks overdue MELs with the days-overdue indicator", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T00:00:00Z"));
    try {
      render(
        <MelTable
          items={[
            makeMel({
              id: "mel-overdue",
              due_at: "2026-07-01T00:00:00Z",  // 9 days ago
            }),
          ]}
        />,
      );

      expect(screen.getByText(/9d overdue/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks due-soon MELs (<7d) with the days-left indicator", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T00:00:00Z"));
    try {
      render(
        <MelTable
          items={[
            makeMel({
              id: "mel-soon",
              due_at: "2026-07-01T00:00:00Z",  // 3 days from now
            }),
          ]}
        />,
      );

      expect(screen.getByText(/3d left/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does NOT flag a MEL due more than 7 days out", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    try {
      render(
        <MelTable
          items={[
            makeMel({
              id: "mel-future",
              due_at: "2026-07-01T00:00:00Z",  // 30 days from now
            }),
          ]}
        />,
      );

      expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/d left/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
