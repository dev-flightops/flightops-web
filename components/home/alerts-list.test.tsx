import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OperationalAlert } from "@/lib/dashboards/operational-snapshot";

import { AlertsList } from "./alerts-list";

function grounded(tail: string): OperationalAlert {
  return {
    id: `grounded-${tail}`,
    severity: "red",
    category: "aircraft_grounded",
    title: `Aircraft grounded — ${tail}`,
    detail: "1 blocking issue open. Cannot dispatch.",
    href: `/maintenance/aircraft/${tail}`,
  } as OperationalAlert;
}

function overdue(flight: string): OperationalAlert {
  return {
    id: `overdue-${flight}`,
    severity: "red",
    category: "flight_overdue",
    title: `Flight overdue — ${flight}`,
    detail: "N100PA · PADU → PANC · no contact 20+ min",
    href: "/flight-following",
  } as OperationalAlert;
}

function melExpiring(tail: string): OperationalAlert {
  return {
    id: `mel-${tail}`,
    severity: "yellow",
    category: "mel_expiring",
    title: `MEL expiring — ${tail}`,
    detail: "ATA 34-11 · due in 31 hours",
    href: `/maintenance/aircraft/${tail}`,
  } as OperationalAlert;
}

describe("AlertsList", () => {
  it("groups by category with a count instead of listing flat", () => {
    // Five grounded aircraft as five near-identical rows is a wall: the
    // eye cannot tell "five aircraft with one problem each" from "one
    // aircraft with five", and a single urgent alert lower down gets
    // lost in the texture.
    render(
      <AlertsList
        alerts={[
          grounded("N200PA"),
          grounded("N301PA"),
          grounded("N402PA"),
          overdue("PGR319"),
        ]}
      />,
    );
    const groundedHeading = screen.getByRole("heading", {
      name: "Aircraft grounded",
    });
    const group = groundedHeading.closest("div")!;
    expect(within(group).getByText("3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Flights overdue" }),
    ).toBeInTheDocument();
  });

  it("does not repeat the category on every row", () => {
    // The group heading already says it. Repeating "Aircraft grounded —"
    // five times is what made this read as a wall of red.
    render(<AlertsList alerts={[grounded("N200PA"), grounded("N301PA")]} />);
    expect(screen.getByText("N200PA")).toBeInTheDocument();
    expect(screen.getByText("N301PA")).toBeInTheDocument();
    expect(
      screen.queryByText(/Aircraft grounded — N200PA/),
    ).not.toBeInTheDocument();
  });

  it("keeps a per-item link so a row is actionable", () => {
    // Clearing a grounded aircraft means opening its maintenance record.
    // A group that only linked to a list would add a step to every fix.
    render(<AlertsList alerts={[grounded("N200PA")]} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/maintenance/aircraft/N200PA",
    );
  });

  it("orders groups by what stops an aircraft leaving", () => {
    render(
      <AlertsList
        alerts={[melExpiring("N100PA"), overdue("PGR319"), grounded("N200PA")]}
      />,
    );
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Aircraft grounded",
      "Flights overdue",
      "MELs expiring within 48 hours",
    ]);
  });

  it("falls back to a yellow count for a group with no red alerts", () => {
    const { container } = render(<AlertsList alerts={[melExpiring("N100PA")]} />);
    expect(container.querySelector(".bg-amber-500")).not.toBeNull();
    expect(container.querySelector(".bg-red-600")).toBeNull();
  });

  it("says nothing needs attention rather than rendering an empty box", () => {
    render(<AlertsList alerts={[]} />);
    expect(screen.getByText(/Nothing needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/fleet is airworthy/i)).toBeInTheDocument();
  });

  it("renders an unexpected title shape rather than dropping it", () => {
    // stripCategoryPrefix splits on an em-dash separator. A title
    // without one should still show something.
    render(
      <AlertsList
        alerts={[{ ...grounded("N200PA"), title: "Something unusual" }]}
      />,
    );
    expect(screen.getByText("Something unusual")).toBeInTheDocument();
  });
});
