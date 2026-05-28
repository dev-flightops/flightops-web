import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Released</Badge>);
    expect(screen.getByText("Released")).toBeInTheDocument();
  });

  it("applies the green variant", () => {
    render(<Badge variant="green">VFR</Badge>);
    expect(screen.getByText("VFR").className).toContain("text-status-green");
  });

  it("applies the red variant", () => {
    render(<Badge variant="red">IFR</Badge>);
    expect(screen.getByText("IFR").className).toContain("text-status-red");
  });

  it("defaults to the gray variant", () => {
    render(<Badge>Scheduled</Badge>);
    expect(screen.getByText("Scheduled").className).toContain("text-status-gray");
  });

  it("has no WCAG A/AA violations across variants", async () => {
    const { container } = render(
      <div>
        <Badge variant="green">VFR</Badge>
        <Badge variant="yellow">MVFR</Badge>
        <Badge variant="red">IFR</Badge>
        <Badge variant="blue">Info</Badge>
        <Badge variant="gray">Scheduled</Badge>
        <Badge variant="orange">Warn</Badge>
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
