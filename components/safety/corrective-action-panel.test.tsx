import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
import type { CorrectiveAction } from "@/lib/api/safety";
import { CorrectiveActionPanel } from "./corrective-action-panel";

describe("linked corrective action due date", () => {
  it("preserves the calendar date without converting UTC midnight to the previous day", () => {
    render(<CorrectiveActionPanel sourceType="safety_report" sourceId="report" canOpen={false}
      items={[{ id: "capa", title: "Clear ramp", due_date: "2026-11-02", status: "closed",
        owner: { full_name: "Sarah" } } as CorrectiveAction]} />);
    expect(screen.getByText(/Owner: Sarah/)).toHaveTextContent("Due Nov 2, 2026");
  });
});
