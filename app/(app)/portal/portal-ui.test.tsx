import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge, formatDate } from "./portal-ui";

describe("formatDate", () => {
  it("renders a plain calendar date, not a shifted timestamp", () => {
    // `new Date("2026-08-20")` is UTC midnight and renders as the 19th
    // anywhere west of Greenwich — which is every station this operator
    // flies to. A customer seeing yesterday's date on their own booking
    // is exactly the kind of small wrongness that costs trust.
    expect(formatDate("2026-08-20")).toBe("Aug 20, 2026");
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("returns the input unchanged when it isn't a date", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("StatusBadge", () => {
  it("labels each status the way the pipeline does", () => {
    render(<StatusBadge status="quoted" />);
    expect(screen.getByText("Quoted")).toBeInTheDocument();
  });

  it("colours completed as done and cancelled as failed", () => {
    const { rerender } = render(<StatusBadge status="completed" />);
    expect(screen.getByText("Completed").className).toContain("status-green");

    rerender(<StatusBadge status="cancelled" />);
    expect(screen.getByText("Cancelled").className).toContain("status-red");
  });

  it("treats confirmed and dispatched as in-progress", () => {
    const { rerender } = render(<StatusBadge status="confirmed" />);
    expect(screen.getByText("Confirmed").className).toContain("status-yellow");

    // Customers read "Scheduled" rather than the internal "Dispatched".
    rerender(<StatusBadge status="dispatched" />);
    expect(screen.getByText("Scheduled").className).toContain("status-yellow");
  });

  it("leaves an early-stage request neutral", () => {
    render(<StatusBadge status="request" />);
    const el = screen.getByText("Requested");
    expect(el.className).not.toContain("status-green");
    expect(el.className).not.toContain("status-red");
  });
});
