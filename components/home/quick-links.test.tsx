import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { QuickLinks, type QuickLink } from "./quick-links";

const links: QuickLink[] = [
  { label: "Live Dispatch", href: "/dispatch", status: "live" },
  { label: "Future Reports", href: "/reports/", status: "m4" },
  { label: "Settings", href: "/settings/", status: "m4", accent: "gold" },
];

describe("QuickLinks", () => {
  it("renders live links as <a> and future ones as <span>", () => {
    render(<QuickLinks links={links} />);
    expect(screen.getByRole("link", { name: "Live Dispatch" })).toBeInTheDocument();

    const future = screen.getByText("Future Reports");
    expect(future.tagName).toBe("SPAN");
    expect(future).toHaveAttribute("aria-disabled", "true");
    expect(future).toHaveAttribute("title", "Coming in M4");
  });

  it("renders nothing when there are no links", () => {
    const { container } = render(<QuickLinks links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = render(<QuickLinks links={links} />);
    await expectNoA11yViolations(container);
  });
});
