import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DepartmentNav } from "./department-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

describe("DepartmentNav", () => {
  it("renders nothing on the root path", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { container } = render(<DepartmentNav />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Operations modules on /dispatch (full legacy list)", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch");
    render(<DepartmentNav />);
    expect(screen.getByTestId("dept-nav-dispatch")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-flight-following")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-currency")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-intelligence")).toBeInTheDocument();
  });

  it("marks the active module's chip with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch/abc-123");
    render(<DepartmentNav />);
    expect(screen.getByTestId("dept-nav-dispatch")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("dept-nav-flight-following")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders Operations modules on /flight-following with the right chip active", () => {
    // Regression: the path prefix was previously `/following` from a
    // pre-rename era, which silently dropped the whole dept nav on
    // /flight-following pages.
    vi.mocked(usePathname).mockReturnValue("/flight-following");
    render(<DepartmentNav />);
    expect(screen.getByTestId("dept-nav-dispatch")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-flight-following")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders future modules as disabled spans with milestone hint", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch");
    render(<DepartmentNav />);
    const weather = screen.getByTestId("dept-nav-weather");
    expect(weather.tagName).toBe("SPAN");
    expect(weather).toHaveAttribute("aria-disabled", "true");
    expect(weather).toHaveAttribute("title", "Coming in M2");
  });

  it("renders the legacy Maintenance subnav on /maintenance (Fleet + 7 future chips + MX Intel)", () => {
    // Parity check against legacy templates/maintenance/dashboard.html
    // sub-nav: Fleet | Work Orders | RTS | Inventory | Expiration |
    // Batch Trace | MX Clock | Availability | ✨ MX Intel.
    // MEL + Squawks are intentionally NOT here — legacy keeps those
    // inside the per-aircraft detail page.
    vi.mocked(usePathname).mockReturnValue("/maintenance");
    render(<DepartmentNav />);

    expect(screen.getByTestId("dept-nav-fleet")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-work-orders")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-rts")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-inventory")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-expiration")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-batch-trace")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-mx-clock")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-availability")).toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-mx-intel")).toBeInTheDocument();

    expect(screen.queryByTestId("dept-nav-mel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dept-nav-squawks")).not.toBeInTheDocument();

    // Fleet is the only live chip — it should be a real link.
    expect(screen.getByTestId("dept-nav-fleet").tagName).toBe("A");
    // Everything else is a disabled span with a milestone hint.
    expect(screen.getByTestId("dept-nav-rts").tagName).toBe("SPAN");
    expect(screen.getByTestId("dept-nav-rts")).toHaveAttribute(
      "title",
      "Coming in M3",
    );
    // MX Intel is M4 (AI-tier) — matches Fleet Brain / Intelligence
    // accents in other depts.
    expect(screen.getByTestId("dept-nav-mx-intel")).toHaveAttribute(
      "title",
      "Coming in M4",
    );
  });
});
