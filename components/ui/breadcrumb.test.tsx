import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { Breadcrumb } from "./breadcrumb";

describe("Breadcrumb", () => {
  it("renders each segment", () => {
    render(
      <Breadcrumb
        segments={[
          { label: "Dashboards", href: "/dashboards" },
          { label: "Executive" },
        ]}
      />,
    );
    expect(screen.getByText("Dashboards")).toBeInTheDocument();
    expect(screen.getByText("Executive")).toBeInTheDocument();
  });

  it("renders segments with href as links", () => {
    render(
      <Breadcrumb
        segments={[
          { label: "Dashboards", href: "/dashboards" },
          { label: "Executive" },
        ]}
      />,
    );
    const link = screen.getByRole("link", { name: "Dashboards" });
    expect(link).toHaveAttribute("href", "/dashboards");
  });

  it("renders the final segment as plain text (no link)", () => {
    render(
      <Breadcrumb
        segments={[
          { label: "Dashboards", href: "/dashboards" },
          { label: "Executive" },
        ]}
      />,
    );
    // "Executive" should NOT be a link
    expect(
      screen.queryByRole("link", { name: "Executive" }),
    ).not.toBeInTheDocument();
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(
      <Breadcrumb
        segments={[
          { label: "Operations" },
          { label: "Dispatch", href: "/dispatch" },
          { label: "GV101" },
        ]}
      />,
    );
    await expectNoA11yViolations(container);
  });
});
