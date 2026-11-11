import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./load-status-actions", () => ({
  acknowledgeLoadAction: vi.fn(),
  startLoadAction: vi.fn(),
  completeLoadAction: vi.fn(),
  reopenLoadAction: vi.fn(),
}));

import { LoadButtons } from "./load-buttons";

const names = () => screen.getAllByRole("button").map((b) => b.textContent);

describe("the load team's next step (#134, LOG-43)", () => {
  it("offers Start loading until loading begins, and Load complete until it's done", () => {
    const { rerender } = render(<LoadButtons assignmentId="as-1" stage="assigned" flightNumber="DEMO104" />);
    expect(names()).toEqual(["Acknowledge the load for DEMO104", "Start loading DEMO104", "Load complete for DEMO104"]);
    rerender(<LoadButtons assignmentId="as-1" stage="acknowledged" flightNumber="DEMO104" />);
    expect(names()).toEqual(["Start loading DEMO104", "Load complete for DEMO104"]);
    rerender(<LoadButtons assignmentId="as-1" stage="loading" flightNumber="DEMO104" />);
    expect(names()).toEqual(["Load complete for DEMO104"]);
    rerender(<LoadButtons assignmentId="as-1" stage="complete" flightNumber="DEMO104" />);
    expect(names()).toEqual(["Reopen the load for DEMO104"]);
  });
});
