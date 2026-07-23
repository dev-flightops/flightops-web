import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import QuyanaMembersPage from "./page";

describe("/reservations/quyana (shell)", () => {
  it("renders legacy header + 6-column table + empty state", () => {
    render(<QuyanaMembersPage />);
    expect(
      screen.getByRole("heading", { name: "Quyana Rewards" }),
    ).toBeDefined();
    expect(screen.getByText(/^0 active members$/)).toBeDefined();
    for (const col of ["Member #", "Customer", "Tier", "Balance", "Lifetime", "Enrolled"]) {
      expect(screen.getByRole("columnheader", { name: col })).toBeDefined();
    }
    expect(screen.getByText("No Quyana Rewards members yet.")).toBeDefined();
  });

  it("renders '+ Enroll Member' as disabled with a milestone tooltip", () => {
    render(<QuyanaMembersPage />);
    const btn = screen.getByRole("button", { name: "+ Enroll Member" });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.getAttribute("title") ?? "").toMatch(/reservations-service/);
  });
});
