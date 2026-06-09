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
});
