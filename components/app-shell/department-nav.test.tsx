import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { activeModuleId, DepartmentNav } from "./department-nav";

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

  it("renders the legacy Maintenance subnav on /maintenance, built entries linked", () => {
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

    // Fleet, Work Orders and MX Intel are built. The other six were
    // asserted live here as "shipped in #172", and their pages existed —
    // as shells: legacy's layout with every control disabled and no
    // maintenance-service endpoint behind any of them. They are
    // `planned` now, dimmed with "Not built yet", and their pages say so.
    for (const [id, href] of [
      ["fleet", "/maintenance"],
      ["work-orders", "/maintenance/work-orders"],
      // MX Intel shipped in M4. It was a disabled span with a "Coming
      // in M4" tooltip, and this assertion is what caught the flip —
      // the nav entry changed and nothing else in the suite noticed.
      ["mx-intel", "/maintenance/mx-intelligence"],
    ] as const) {
      const chip = screen.getByTestId(`dept-nav-${id}`);
      expect(chip.tagName).toBe("A");
      expect(chip).toHaveAttribute("href", href);
    }
    for (const id of [
      "rts",
      "inventory",
      "expiration",
      "batch-trace",
      "mx-clock",
      "availability",
    ]) {
      const chip = screen.getByTestId(`dept-nav-${id}`);
      expect(chip.tagName).toBe("SPAN");
      expect(chip).toHaveAttribute("aria-disabled", "true");
      expect(chip).toHaveAttribute("title", "Not built yet");
    }
    // The AI accent survives going live. It is what tells a mechanic
    // this chip opens a model rather than a record.
    expect(screen.getByTestId("dept-nav-mx-intel").className).toContain(
      "purple",
    );
  });
});

describe("one current module", () => {
  it("lights only Assignments on /academy/assignments, not the /academy library too", () => {
    vi.mocked(usePathname).mockReturnValue("/academy/assignments");
    render(<DepartmentNav />);
    expect(screen.getByTestId("dept-nav-academy-assignments")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByTestId("dept-nav-academy-course-library"),
    ).not.toHaveAttribute("aria-current");
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("still lights the library on a course under /academy", () => {
    vi.mocked(usePathname).mockReturnValue("/academy/0c1d-course");
    render(<DepartmentNav />);
    expect(
      screen.getByTestId("dept-nav-academy-course-library"),
    ).toHaveAttribute("aria-current", "page");
  });

  const live = (id: string, href: string) => ({ id, href, status: "live" as const });

  it("prefers the most specific href", () => {
    const mods = [live("lib", "/academy"), live("assign", "/academy/assignments")];
    expect(activeModuleId(mods, "/academy/assignments/x")).toBe("assign");
    expect(activeModuleId(mods, "/academy")).toBe("lib");
  });

  it("matches whole path segments only", () => {
    const mods = [live("fuel", "/fuel")];
    expect(activeModuleId(mods, "/fuel-supplier")).toBeNull();
    expect(activeModuleId(mods, "/fuel/orders")).toBe("fuel");
  });

  it("ignores trailing slashes and an href's query string", () => {
    const mods = [live("hist", "/flight-crew/history?tab=duty"), live("home", "/home/")];
    expect(activeModuleId(mods, "/flight-crew/history/")).toBe("hist");
    expect(activeModuleId(mods, "/home")).toBe("home");
  });

  it("never marks an unbuilt module current", () => {
    expect(
      activeModuleId([{ id: "crew", href: "/crew", status: "m3" }], "/crew"),
    ).toBeNull();
  });
});

describe("the academy strip", () => {
  it("carries My Training, which only the removed in-page tab row had", () => {
    vi.mocked(usePathname).mockReturnValue("/academy/mine");
    render(<DepartmentNav />);
    const chip = screen.getByTestId("dept-nav-academy-my-training");
    expect(chip).toHaveAttribute("href", "/academy/mine");
    expect(chip).toHaveAttribute("aria-current", "page");
  });
});

describe("a page the role cannot see", () => {
  it("R7: marks no chip current, not the nearest chip the role can see", () => {
    // A dispatcher who opens the accounting export by URL. New Booking
    // (/reservations) prefixes the path, but it is not where they are.
    vi.mocked(usePathname).mockReturnValue("/reservations/accounting-export");
    render(<DepartmentNav roles={["dispatcher"]} />);
    expect(
      screen.queryByTestId("dept-nav-reservations-acct-export"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("dept-nav-reservations-search")).not.toHaveAttribute(
      "aria-current",
    );
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });

  it("still marks the export current for a role that sees it", () => {
    vi.mocked(usePathname).mockReturnValue("/reservations/accounting-export");
    render(<DepartmentNav roles={["director_of_operations"]} />);
    expect(
      screen.getByTestId("dept-nav-reservations-acct-export"),
    ).toHaveAttribute("aria-current", "page");
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("still marks New Booking current on /reservations for the dispatcher", () => {
    vi.mocked(usePathname).mockReturnValue("/reservations");
    render(<DepartmentNav roles={["dispatcher"]} />);
    expect(screen.getByTestId("dept-nav-reservations-search")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
