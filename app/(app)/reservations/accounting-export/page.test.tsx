import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AccountingExportPage from "./page";

describe("/reservations/accounting-export (shell)", () => {
  it("renders legacy header + subtitle + Export CSV disabled button", () => {
    render(<AccountingExportPage />);
    expect(
      screen.getByRole("heading", { name: "Accounting Export" }),
    ).toBeDefined();
    expect(
      screen.getByText(/Review completed flight activity/),
    ).toBeDefined();
    const btn = screen.getByRole("button", { name: /Export CSV/ });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.textContent).toMatch(/\(0 rows\)/);
  });

  it("renders 4 summary tiles + 11-column activity table", () => {
    render(<AccountingExportPage />);
    for (const label of ["Completed Flights", "Revenue Passengers", "Cargo", "Mail (USPS)"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
    for (const col of [
      "Date",
      "Flight #",
      "Type",
      "Route",
      "Aircraft",
      "PIC",
      "Customer",
      "Rev Pax",
      "Cargo lbs",
      "Mail lbs",
      "Notes",
    ]) {
      expect(screen.getByRole("columnheader", { name: col })).toBeDefined();
    }
    expect(screen.getByText(/No completed flights in this date range/)).toBeDefined();
  });

  it("renders the 'About this export' info panel from legacy", () => {
    render(<AccountingExportPage />);
    expect(
      screen.getByText(/QuickBooks, Xero, Sage, or any system that accepts CSV/),
    ).toBeDefined();
  });

  it("filter bar renders From / To / Customer / Filter / Reset controls", () => {
    render(<AccountingExportPage />);
    expect(screen.getByRole("search")).toBeDefined();
    expect(screen.getByRole("button", { name: "Filter" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
  });
});
