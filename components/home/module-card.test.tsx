import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { ModuleCard } from "./module-card";
import type { HomeModule } from "./module-catalog";

const liveDispatch: HomeModule = {
  id: "dispatch",
  label: "Dispatch",
  sub: "Release, weather, crew, following",
  href: "/dispatch",
  status: "live",
  color: "#0a84ff",
  iconPath: "M14 2H6c-1.1 0-2 .9-2 2v16",
};

const futureMaintenance: HomeModule = {
  id: "maintenance",
  label: "Maintenance",
  sub: "Aircraft, squawks, MEL",
  href: "/maintenance/",
  status: "m2",
  color: "#f87171",
  iconPath: "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9",
};

describe("ModuleCard", () => {
  it("renders a live module as a link to its href", () => {
    render(<ModuleCard module={liveDispatch} />);
    const card = screen.getByTestId("mod-card-dispatch");
    expect(card.tagName).toBe("A");
    expect(card).toHaveAttribute("href", "/dispatch");
    expect(screen.getByText("Dispatch")).toBeInTheDocument();
    expect(screen.getByText("Release, weather, crew, following")).toBeInTheDocument();
  });

  it("renders a future module as a non-link with aria-disabled + tooltip", () => {
    render(<ModuleCard module={futureMaintenance} />);
    const card = screen.getByTestId("mod-card-maintenance");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).toHaveAttribute("title", "Coming in M2");
  });

  it("applies the highlight treatment when module.highlight is true", () => {
    render(
      <ModuleCard module={{ ...liveDispatch, highlight: true }} />,
    );
    const card = screen.getByTestId("mod-card-dispatch");
    expect(card.className).toContain("border-primary/30");
  });

  it("has no WCAG A/AA violations for live + disabled cards", async () => {
    const { container } = render(
      <div className="grid">
        <ModuleCard module={liveDispatch} />
        <ModuleCard module={futureMaintenance} />
      </div>,
    );
    await expectNoA11yViolations(container);
  });
});
