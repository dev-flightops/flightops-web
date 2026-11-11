import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordTabs } from "./record-tabs";

/**
 * The employee record's tab bar.
 *
 * Profile and Documents are ours. Onboarding and Drug & Alcohol are
 * subsystems nobody has scheduled — 5 tables behind one and 9 behind
 * the other in legacy — so they aren't shown, rather than linked (two
 * 404s) or dimmed and marked "Not built" (which the client counted as
 * faults, #134).
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

describe("Onboarding (#180) and Drug & Alcohol", () => {
  it("shows Onboarding, linked, with what's required before starting", () => {
    render(<RecordTabs employeeId="u-1" active="profile" requiredOpen={2} />);
    const tab = screen.getByRole("link", { name: /Onboarding/ });
    expect(tab).toHaveAttribute("href", "/employees/u-1?tab=onboarding");
    expect(screen.getByTitle("2 tasks required before starting")).toHaveTextContent("2");
  });

  it("marks Onboarding as the page when it's open", () => {
    render(<RecordTabs employeeId="u-1" active="onboarding" />);
    expect(screen.getByText("Onboarding")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByTitle(/required before starting/)).not.toBeInTheDocument();
  });

  it("shows Drug & Alcohol, linked, marked when they aren't cleared", () => {
    render(<RecordTabs employeeId="u-1" active="profile" notCleared />);
    const tab = screen.getByRole("link", { name: /Drug & Alcohol/ });
    expect(tab).toHaveAttribute("href", "/employees/u-1?tab=drug-alcohol");
    expect(screen.getByTitle("Not cleared for safety-sensitive duty")).toBeInTheDocument();
    expect(screen.queryByText("Not built")).not.toBeInTheDocument();
  });

  it("doesn't mark Drug & Alcohol for someone cleared or not safety-sensitive", () => {
    render(<RecordTabs employeeId="u-1" active="drug-alcohol" />);
    expect(screen.getByText("Drug & Alcohol")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByTitle("Not cleared for safety-sensitive duty")).not.toBeInTheDocument();
  });
});
