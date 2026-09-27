import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { EmptyPanel, SectionPanel } from "./section-panel";

describe("SectionPanel", () => {
  it("renders title + children", () => {
    render(
      <SectionPanel title="Flight Details">
        <p>body</p>
      </SectionPanel>,
    );
    expect(screen.getByText("Flight Details")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders a titleAction in the header row", () => {
    render(
      <SectionPanel title="Route" titleAction={<button>Refresh</button>}>
        body
      </SectionPanel>,
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });

  it("applies the blue left accent when accent='blue'", () => {
    const { container } = render(
      <SectionPanel title="Load from Schedule" accent="blue">
        body
      </SectionPanel>,
    );
    expect(container.firstChild).toHaveClass("border-l-status-blue");
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(
      <SectionPanel title="Flight Details">
        <p>body</p>
      </SectionPanel>,
    );
    await expectNoA11yViolations(container);
  });
});

describe("EmptyPanel", () => {
  // Every panel that shows this is built — it only means "pick a flight
  // first". It used to carry a "Soon" pill, which told dispatchers the
  // Weather, Fuel, Maintenance and Alternate panels were unfinished.
  it("renders the title and what to do, with no Soon pill", () => {
    render(
      <EmptyPanel
        title="Weather & ATIS"
        hint="Pick a flight to pull METAR + TAF."
      />,
    );
    expect(screen.getByText("Weather & ATIS")).toBeInTheDocument();
    expect(
      screen.getByText("Pick a flight to pull METAR + TAF."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/soon/i)).not.toBeInTheDocument();
    expect(document.querySelector("[title]")).toBeNull();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <EmptyPanel title="Fuel" hint="Empty state copy" accent="yellow" />,
    );
    await expectNoA11yViolations(container);
  });
});
