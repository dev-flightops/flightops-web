import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrimaryNav } from "./primary-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

describe("PrimaryNav", () => {
  it("renders one chip for every department", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch");
    render(<PrimaryNav />);
    for (const label of ["Operations", "Maintenance", "Crew", "Safety", "Admin", "AI"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the Operations chip as active when the path is /dispatch", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch");
    render(<PrimaryNav />);
    const operations = screen.getByTestId("primary-nav-operations");
    expect(operations).toHaveAttribute("aria-current", "page");
  });

  it("does NOT mark Operations as active for /", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<PrimaryNav />);
    expect(screen.queryByTestId("primary-nav-operations")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders disabled modules as <span> with aria-disabled", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch");
    render(<PrimaryNav />);
    const maintenance = screen.getByTestId("primary-nav-maintenance");
    expect(maintenance.tagName).toBe("SPAN");
    expect(maintenance).toHaveAttribute("aria-disabled", "true");
    expect(maintenance).toHaveAttribute("title", "Coming in M2");
  });

  it("renders Operations as a link (not a span) so it can navigate", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch");
    render(<PrimaryNav />);
    const operations = screen.getByTestId("primary-nav-operations");
    expect(operations.tagName).toBe("A");
    expect(operations).toHaveAttribute("href", "/dispatch");
  });
});
