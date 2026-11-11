import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HandoffItem } from "@/lib/api/types";

import { myTask } from "@/app/(app)/employees/onboarding/test-fixtures";

import { WaitingOnYouList, drugAlcoholLines } from "./waiting-on-you-list";

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

describe("onboarding tasks in Waiting on you (#180)", () => {
  it("adds the reader's onboarding tasks after the flights, overdue ones marked", () => {
    render(
      <WaitingOnYouList
        items={[item()]}
        onboarding={[myTask({ id: "t-7", name: "Ramp tour", overdue: true, due_date: "2026-11-05" })]}
      />,
    );
    expect(screen.getByText("2 to do")).toBeInTheDocument();
    const row = screen.getByText("Onboarding: Ramp tour").closest("li")!;
    expect(within(row).getByText(/Nina Hale · New Hire Pilot · overdue since/)).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Open ›" })).toHaveAttribute("href", "/employees/onboarding/a-1");
    expect(row.className).toContain("border-l-status-red");
  });

  it("still shows the onboarding tasks when the flights couldn't be checked", () => {
    render(<WaitingOnYouList items={null} onboarding={[myTask()]} />);
    expect(screen.getByText("Onboarding: Read the GOM")).toBeInTheDocument();
    expect(screen.getByText(/Couldn.t check the flights waiting on you/)).toBeInTheDocument();
  });
});

describe("the drug and alcohol program in Waiting on you", () => {
  it("gives whoever runs it what's waiting, and the leaders who isn't cleared", () => {
    render(
      <WaitingOnYouList
        items={[]}
        drugAlcohol={{
          runs_program: true,
          sees_clearance: true,
          not_cleared: 2,
          to_test: 1,
          pending_results: 3,
          ready_to_return: 0,
        }}
      />,
    );
    expect(screen.getByText("Drug & alcohol: 1 random test to collect")).toBeInTheDocument();
    expect(screen.getByText("Drug & alcohol: 3 tests waiting on a result")).toBeInTheDocument();
    expect(screen.getByText("Drug & alcohol: 2 people not cleared for safety-sensitive duty")).toBeInTheDocument();
    expect(screen.queryByText(/return to duty/)).not.toBeInTheDocument();
    expect(screen.getByText("3 to do")).toBeInTheDocument();
  });

  it("tells a leader only how many aren't cleared, and to ask the DER", () => {
    expect(drugAlcoholLines({ runs_program: false, sees_clearance: true, not_cleared: 1 })).toEqual([
      expect.objectContaining({ title: "1 person not cleared for safety-sensitive duty", detail: "Ask the DER about them." }),
    ]);
    expect(drugAlcoholLines({ runs_program: false, sees_clearance: false })).toEqual([]);
    expect(drugAlcoholLines(null)).toEqual([]);
  });
});
