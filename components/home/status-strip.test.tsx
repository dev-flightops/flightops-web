import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { StatusStrip } from "./status-strip";

describe("StatusStrip", () => {
  it("renders each item with value + label", () => {
    render(
      <StatusStrip
        items={[
          { value: 3, label: "airborne", color: "#34d399" },
          { value: 7, label: "on ground", color: "#fbbf24" },
        ]}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("airborne")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("on ground")).toBeInTheDocument();
  });

  it("renders nothing when items is empty", () => {
    const { container } = render(<StatusStrip items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mutes the value when pending=true (no live tracker behind it)", () => {
    render(
      <StatusStrip items={[{ value: 0, label: "airborne", pending: true }]} />,
    );
    const value = screen.getByText("0");
    expect(value.className).toContain("opacity-50");
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(
      <StatusStrip
        items={[
          { value: 0, label: "airborne", pending: true },
          { value: 5, label: "on ground", color: "#fbbf24" },
          { value: 1, label: "acft hold", color: "#f87171" },
        ]}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
