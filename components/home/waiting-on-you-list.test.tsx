import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HandoffItem } from "@/lib/api/types";

import { WaitingOnYouList } from "./waiting-on-you-list";

const item = (over: Partial<HandoffItem> = {}): HandoffItem => ({
  kind: "release_to_accept",
  turn: "pilot",
  flight_id: "fl-118",
  flight_number: "MM118",
  origin: "PABE",
  destination: "PACK",
  scheduled_departure_at: "2026-11-09T18:00:00Z",
  occurred_at: "2026-11-09T17:10:00Z",
  by_name: "Dana Dispatch",
  filed_by_pilot: false,
  refiled: false,
  note: null,
  ...over,
});

describe("Home's Waiting on you (#175)", () => {
  it("lists what waits on this person, each with where to do it", () => {
    render(<WaitingOnYouList items={[item()]} />);
    const list = screen.getByRole("list");
    expect(within(list).getByText("Release to accept — MM118")).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Open ›" })).toHaveAttribute(
      "href",
      "/flight-crew/preflight/fl-118",
    );
    expect(screen.getByText("1 to do")).toBeInTheDocument();
  });

  it("says when nothing is waiting, and when it couldn't check", () => {
    const { unmount } = render(<WaitingOnYouList items={[]} />);
    expect(screen.getByText("Nothing is waiting on you.")).toBeInTheDocument();
    unmount();
    render(<WaitingOnYouList items={null} />);
    expect(screen.getByText(/Couldn.t check what.s waiting on you/)).toBeInTheDocument();
  });
});
