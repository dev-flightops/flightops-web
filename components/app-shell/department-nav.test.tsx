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
    // Crew + Currency are M3 — assert one of them keeps the disabled-span shape.
    const crew = screen.getByTestId("dept-nav-crew");
    expect(crew.tagName).toBe("SPAN");
    expect(crew).toHaveAttribute("aria-disabled", "true");
    expect(crew).toHaveAttribute("title", "Coming in M3");
  });

  it("renders Village Wx + Ramp Ops as live links (M2)", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch");
    render(<DepartmentNav />);
    const villageWx = screen.getByTestId("dept-nav-village-wx");
    expect(villageWx.tagName).toBe("A");
    expect(villageWx).toHaveAttribute("href", "/village-wx");

    const rampOps = screen.getByTestId("dept-nav-ramp-ops");
    expect(rampOps.tagName).toBe("A");
    expect(rampOps).toHaveAttribute("href", "/ramp-ops");
  });

  it("renders Weather as a live link (M2-G-24)", () => {
    vi.mocked(usePathname).mockReturnValue("/dispatch");
    render(<DepartmentNav />);
    const weather = screen.getByTestId("dept-nav-weather");
    expect(weather.tagName).toBe("A");
    expect(weather).toHaveAttribute("href", "/weather");
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

    // Fleet + the 7 sub-pages shipped in #172 (Work Orders, RTS,
    // Inventory, Expiration, Batch Trace, MX Clock, Availability) are
    // all live — each should be a real link with a matching href.
    for (const [id, href] of [
      ["fleet", "/maintenance"],
      ["work-orders", "/maintenance/work-orders"],
      ["rts", "/maintenance/rts"],
      ["inventory", "/maintenance/inventory"],
      ["expiration", "/maintenance/expiration"],
      ["batch-trace", "/maintenance/batch-trace"],
      ["mx-clock", "/maintenance/mx-clock"],
      ["availability", "/maintenance/availability"],
    ] as const) {
      const chip = screen.getByTestId(`dept-nav-${id}`);
      expect(chip.tagName).toBe("A");
      expect(chip).toHaveAttribute("href", href);
    }
    // MX Intel is still M4 (AI-tier) — renders as a disabled span with
    // the milestone tooltip, matches Fleet Brain / Intelligence
    // accents in other depts.
    expect(screen.getByTestId("dept-nav-mx-intel").tagName).toBe("SPAN");
    expect(screen.getByTestId("dept-nav-mx-intel")).toHaveAttribute(
      "title",
      "Coming in M4",
    );
  });
});
