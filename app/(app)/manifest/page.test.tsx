import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ManifestListPage from "./page";

describe("/manifest (shell)", () => {
  it("renders legacy header + 8-column table + empty state", () => {
    render(<ManifestListPage />);
    expect(
      screen.getByRole("heading", { name: "Passenger Manifests" }),
    ).toBeDefined();
    expect(
      screen.getByText(/Weight & balance and passenger records/),
    ).toBeDefined();
    for (const col of [
      "Date",
      "Flight",
      "Aircraft",
      "Route",
      "Pax",
      "Total Payload",
      "Status",
    ]) {
      expect(screen.getByRole("columnheader", { name: col })).toBeDefined();
    }
    expect(screen.getByText("No manifests yet.")).toBeDefined();
  });

  it("renders both New Manifest CTAs as disabled with a milestone tooltip", () => {
    render(<ManifestListPage />);
    const primary = screen.getByRole("button", { name: "+ New Manifest" });
    const secondary = screen.getByRole("button", { name: "Create First Manifest" });
    for (const btn of [primary, secondary]) {
      expect(btn.getAttribute("aria-disabled")).toBe("true");
      expect(btn.getAttribute("title") ?? "").toMatch(/reservations-service/);
    }
  });
});
