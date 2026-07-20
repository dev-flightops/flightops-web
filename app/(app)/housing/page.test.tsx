import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HousingPage from "./page";

describe("/housing (shell)", () => {
  it("renders the legacy header + stats subtitle", () => {
    render(<HousingPage />);
    expect(
      screen.getByRole("heading", { name: "Housing Management" }),
    ).toBeDefined();
    // Zero-state stats — text is split across colored spans, so match
    // each token individually rather than the full string.
    expect(screen.getByText(/0 houses/)).toBeDefined();
    expect(screen.getByText(/0 rooms/)).toBeDefined();
    expect(screen.getByText(/0 available/)).toBeDefined();
    expect(screen.getByText(/0 occupied/)).toBeDefined();
  });

  it("renders the header cluster — all four action buttons disabled", () => {
    render(<HousingPage />);
    for (const name of [
      "Assignments",
      "Maintenance",
      "Reports",
      "+ New House",
      /AI Assistant/,
    ]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("renders the calendar nav with Today active + others disabled", () => {
    render(<HousingPage />);
    const today = screen.getByRole("button", { name: "Today" });
    expect(today.getAttribute("aria-pressed")).toBe("true");
    expect(today.getAttribute("aria-disabled")).toBe("true");
    for (const name of ["← Month", "← Week", "Week →", "Month →"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("renders all six tag colors + a disabled + Tag button + the drag hint", () => {
    render(<HousingPage />);
    for (const label of [
      "Pilots",
      "Mechanics",
      "Dispatch",
      "Management",
      "Training",
      "VIP",
    ]) {
      expect(screen.getByText(label)).toBeDefined();
    }
    const addTag = screen.getByRole("button", { name: "+ Tag" });
    expect(addTag.getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.getByText(
        /Drag a tag across room cells to book. Release to open the booking form./,
      ),
    ).toBeDefined();
  });

  it("shows the empty-state copy from legacy", () => {
    render(<HousingPage />);
    expect(
      screen.getByText(
        "No housing units available. Create a house to get started.",
      ),
    ).toBeDefined();
  });
});
