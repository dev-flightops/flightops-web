import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DutyPeriodSummary } from "@/lib/api/types";

// The Correct control reaches a server action, and through it next-auth,
// which does not resolve under vitest.
vi.mock("@/components/duty/correct-duty", () => ({ CorrectDuty: () => null }));

import { DutyHistoryTable } from "./duty-history-table";

function period(over: Partial<DutyPeriodSummary> = {}): DutyPeriodSummary {
  return {
    id: "d-1",
    clock_in_at: "2026-10-11T15:00:00Z",
    clock_out_at: "2026-10-12T01:00:00Z",
    elapsed_hours: 10,
    is_open: false,
    rest_acknowledged: false,
    ...over,
  };
}

// #100: the pilot sees who corrected their record, when and why.
describe("DutyHistoryTable", () => {
  it("says who corrected a period, when and why", () => {
    render(
      <DutyHistoryTable
        periods={[period({ corrected: { by: "Kim Chief", at: "2026-10-21T18:00:00Z", reason: "Forgot to clock out." } })]}
      />,
    );
    expect(screen.getByText("Corrected by Kim Chief, 2026-10-21: Forgot to clock out.")).toBeInTheDocument();
  });

  it("says nothing of a period nobody else corrected", () => {
    render(<DutyHistoryTable periods={[period(), period({ id: "d-2", corrected: null })]} />);
    expect(screen.queryByText(/Corrected by/)).not.toBeInTheDocument();
  });

  it("names the pilot when a corrector reads an empty history", () => {
    render(<DutyHistoryTable periods={[]} pilotName="Bob Henderson" />);
    expect(screen.getByText("No duty periods on file for Bob Henderson.")).toBeInTheDocument();
    expect(screen.queryByText(/Clock In from the Flight Crew page/)).not.toBeInTheDocument();
  });
});
