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
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("N200PA")).toBeInTheDocument();
    expect(within(rows[1]).getByText("N301PA")).toBeInTheDocument();
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
    // without one should still show something — in the row and in the
    // collapsed summary, which both go through the same helper.
    render(
      <AlertsList
        alerts={[{ ...grounded("N200PA"), title: "Something unusual" }]}
      />,
    );
    expect(screen.getAllByText("Something unusual").length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole("listitem")).getByText("Something unusual"),
    ).toBeInTheDocument();
  });
});

describe("collapsing", () => {
  const summaryOf = (container: HTMLElement) =>
    container.querySelector("summary") as HTMLElement;

  it("makes every group a collapsible section", () => {
    const { container } = render(
      <AlertsList alerts={[grounded("N200PA"), melExpiring("N301PA")]} />,
    );
    expect(container.querySelectorAll("details")).toHaveLength(2);
    expect(container.querySelectorAll("summary")).toHaveLength(2);
  });

  it("starts collapsed", () => {
    const { container } = render(<AlertsList alerts={[grounded("N200PA")]} />);
    for (const d of container.querySelectorAll("details")) {
      expect((d as HTMLDetailsElement).open).toBe(false);
    }
  });

  it("keeps the count and the category on the closed row", () => {
    // Collapsed must still answer "how many, and of what" without a
    // click, or the panel is just hiding the problem.
    const { container } = render(
      <AlertsList alerts={[grounded("N200PA"), grounded("N301PA")]} />,
    );
    const summary = summaryOf(container);
    expect(within(summary).getByText("2")).toBeInTheDocument();
    expect(within(summary).getByText(/Aircraft grounded/)).toBeInTheDocument();
  });

  it("names the affected aircraft on the closed row", () => {
    // The point of collapsing is to hide the detail, not the answer to
    // "which ones?". A dispatcher should not have to open a group to
    // find out whether their aircraft is in it.
    const { container } = render(
      <AlertsList alerts={[grounded("N200PA"), grounded("N301PA")]} />,
    );
    expect(summaryOf(container).textContent).toContain("N200PA");
    expect(summaryOf(container).textContent).toContain("N301PA");
  });

  it("caps a long list and says how many more", () => {
    const { container } = render(
      <AlertsList
        alerts={["N1", "N2", "N3", "N4", "N5"].map(grounded)}
      />,
    );
    const text = summaryOf(container).textContent ?? "";
    expect(text).toContain("N1, N2, N3");
    expect(text).toContain("+2 more");
    // The tails past the cap stay out of the closed row — that is the
    // wall the cap exists to prevent.
    expect(text).not.toContain("N4");
  });

  it("does not say +N more when everything fits", () => {
    const { container } = render(
      <AlertsList alerts={[grounded("N200PA"), grounded("N301PA")]} />,
    );
    expect(summaryOf(container).textContent).not.toMatch(/\+\d+ more/);
  });

  it("still renders every item inside the group", () => {
    // Collapsed is a display state, not a filter. All five are in the
    // DOM and reachable by keyboard and screen reader.
    render(<AlertsList alerts={["N1", "N2", "N3", "N4", "N5"].map(grounded)} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("renders no collapsible section when there is nothing to show", () => {
    const { container } = render(<AlertsList alerts={[]} />);
    expect(container.querySelectorAll("details")).toHaveLength(0);
  });
});
