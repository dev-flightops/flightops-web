import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordTabs } from "./record-tabs";

/**
 * The employee record's tab bar.
 *
 * Profile and Documents are ours. Onboarding and Drug & Alcohol are
 * subsystems nobody has scheduled — 5 tables behind one and 9 behind
 * the other in legacy — so they stay rendered and marked rather than
 * dropped (which hides that the record has more to it) or linked
 * (which gives two 404s).
 */

describe("the built tabs", () => {
  it("marks the tab you are on and does not link it to itself", () => {
    render(<RecordTabs employeeId="u-1" active="profile" />);
    expect(screen.getByText("Profile")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("link", { name: "Profile" }),
    ).not.toBeInTheDocument();
  });

  it("links Documents from the profile tab", () => {
    render(<RecordTabs employeeId="u-1" active="profile" />);
    expect(screen.getByRole("link", { name: /Documents/ })).toHaveAttribute(
      "href",
      "/employees/u-1?tab=documents",
    );
  });

  it("links back to the profile from the documents tab", () => {
    render(<RecordTabs employeeId="u-1" active="documents" />);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/employees/u-1",
    );
    expect(screen.getByText(/Documents/)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("the outstanding count", () => {
  it("shows on the Documents tab so an expired medical is visible from the profile", () => {
    render(<RecordTabs employeeId="u-1" active="profile" outstanding={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("is absent rather than a zero when nothing is outstanding", () => {
    // A badge reading 0 is noise that looks like a problem.
    render(<RecordTabs employeeId="u-1" active="profile" outstanding={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("is absent when the checklist could not be loaded", () => {
    // undefined, not 0 — "we could not count" is not "none".
    render(<RecordTabs employeeId="u-1" active="profile" />);
    expect(
      screen.getByRole("link", { name: "Documents" }),
    ).toBeInTheDocument();
  });
});

describe("the unbuilt tabs", () => {
  it("shows both rather than hiding them", () => {
    render(<RecordTabs employeeId="u-1" active="profile" />);
    for (const label of ["Onboarding", "Drug & Alcohol"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("says not built, not soon", () => {
    // Neither is on a story list. "Soon" was a commitment nothing
    // backs.
    render(<RecordTabs employeeId="u-1" active="profile" />);
    expect(screen.getAllByText("Not built")).toHaveLength(2);
    expect(screen.queryByText("Soon")).not.toBeInTheDocument();
  });

  it("says in the tooltip that they are not scheduled either", () => {
    render(<RecordTabs employeeId="u-1" active="profile" />);
    expect(screen.getByText("Onboarding").closest("span")).toHaveAttribute(
      "title",
      expect.stringContaining("not currently scheduled"),
    );
  });

  it("does not make them clickable", () => {
    render(<RecordTabs employeeId="u-1" active="profile" />);
    for (const label of ["Onboarding", "Drug & Alcohol"]) {
      expect(
        screen.queryByRole("link", { name: label }),
      ).not.toBeInTheDocument();
    }
  });

  it("no longer claims Documents is unbuilt", () => {
    // It was in that list until this feature shipped.
    render(<RecordTabs employeeId="u-1" active="profile" />);
    const documents = screen.getByRole("link", { name: /Documents/ });
    expect(documents.textContent).not.toMatch(/Not built/);
  });
});
