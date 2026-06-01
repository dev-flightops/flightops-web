import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { DisabledPanel, SectionPanel } from "./section-panel";

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

describe("DisabledPanel", () => {
  it("renders the milestone tag + hint", () => {
    render(
      <DisabledPanel
        title="Weather & ATIS"
        milestone="M2"
        hint="Enter routing to pull METAR/TAF."
      />,
    );
    expect(screen.getByText("Weather & ATIS")).toBeInTheDocument();
    expect(screen.getByText("M2")).toBeInTheDocument();
    expect(
      screen.getByText(/Enter routing to pull METAR\/TAF/),
    ).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <DisabledPanel
        title="NOTAM Review"
        milestone="M2"
        hint="Empty state copy"
      />,
    );
    await expectNoA11yViolations(container);
  });
});
