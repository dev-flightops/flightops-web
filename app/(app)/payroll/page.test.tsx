import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PayrollPage from "./page";

describe("/payroll (shell)", () => {
  it("renders the legacy header + subtitle + empty state", () => {
    render(<PayrollPage />);
    expect(screen.getByRole("heading", { name: "Pay Events" })).toBeDefined();
    expect(screen.getByText(/^0 events$/)).toBeDefined();
    expect(screen.getByText("No pay events found.")).toBeDefined();
  });

  it("renders Pay Periods + '+ New Pay Event' buttons, both disabled with tooltip", () => {
    render(<PayrollPage />);
    for (const name of ["Pay Periods", "+ New Pay Event"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.getAttribute("aria-disabled")).toBe("true");
      expect(btn.getAttribute("title") ?? "").toMatch(/payroll-service/);
    }
  });
});
