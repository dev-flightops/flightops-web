import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UserResponse } from "@/lib/api/types";

import { EmployeeRecord } from "./employee-record";

/**
 * The employee record behind /employees/{id}.
 *
 * Most of a personnel record is empty most of the time — onboarding
 * fills it in over weeks — so the interesting behaviour is what the page
 * does with a field nobody has entered yet. It says so, rather than
 * showing a dash that reads as either "none" or "we didn't ask".
 */

function employee(over: Partial<UserResponse> = {}): UserResponse {
  return {
    id: "u-1",
    email: "dawn@peregrine.local",
    full_name: "Dawn Whitfield",
    is_active: true,
    roles: ["dispatcher"],
    has_password: true,
    last_login_at: null,
    created_at: "2026-01-01T00:00:00Z",
    emp_number: null,
    title: null,
    station: null,
    employment_type: null,
    hire_date: null,
    termination_date: null,
    first_name: null,
    last_name: null,
    preferred_name: null,
    date_of_birth: null,
    department: null,
    phone: null,
    address: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relation: null,
    notes: null,
    ...over,
  } as UserResponse;
}

const renderRecord = (over: Partial<UserResponse> = {}) =>
  render(<EmployeeRecord employee={employee(over)} />);

describe("an empty record", () => {
  it("says each field is not recorded rather than dashing it", () => {
    renderRecord();
    // Five identity + six employment + three contact + three emergency,
    // less the email which the fixture sets.
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThanOrEqual(15);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("still names the person and says whether they are active", () => {
    // A record with nothing filled in is the normal state on day one,
    // and the page has to be usable then.
    renderRecord();
    expect(
      screen.getByRole("heading", { name: "Dawn Whitfield" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("says so when there are no employment details at all", () => {
    renderRecord();
    expect(
      screen.getByText("No employment details recorded"),
    ).toBeInTheDocument();
  });
});

describe("naming", () => {
  it("prefers the name the person goes by", () => {
    renderRecord({ preferred_name: "Dee" });
    expect(screen.getByRole("heading", { name: "Dee" })).toBeInTheDocument();
  });

  it("falls back to the full name when there is no preferred one", () => {
    renderRecord({ preferred_name: null });
    expect(
      screen.getByRole("heading", { name: "Dawn Whitfield" }),
    ).toBeInTheDocument();
  });

  it("ignores a preferred name that is only whitespace", () => {
    // An empty-ish value would otherwise render a blank heading.
    renderRecord({ preferred_name: "   " });
    expect(
      screen.getByRole("heading", { name: "Dawn Whitfield" }),
    ).toBeInTheDocument();
  });
});

describe("the header line", () => {
  it("joins the details it has and omits the ones it does not", () => {
    renderRecord({
      emp_number: "DEMO-203",
      department: "Maintenance",
      title: "A&P",
    });
    expect(screen.getByText("DEMO-203 · Maintenance · A&P")).toBeInTheDocument();
  });

  it("does not leave separators dangling when a part is missing", () => {
    renderRecord({ emp_number: "DEMO-203", department: null, title: "A&P" });
    expect(screen.getByText("DEMO-203 · A&P")).toBeInTheDocument();
  });
});

describe("fields", () => {
  it("looks the employment type up rather than printing the enum", () => {
    renderRecord({ employment_type: "full_time" as never });
    expect(screen.getByText("Full Time")).toBeInTheDocument();
    expect(screen.queryByText("full_time")).not.toBeInTheDocument();
  });

  it("renders dates as the day given, in any host zone", () => {
    // A date of birth off by one is wrong on a personnel record in a way
    // nobody notices until it matters.
    for (const tz of ["UTC", "Asia/Tokyo", "America/Anchorage"]) {
      const previous = process.env.TZ;
      process.env.TZ = tz;
      const { unmount } = renderRecord({
        date_of_birth: "1985-06-14",
        hire_date: "2024-01-15",
      });
      expect(
        screen.getByText("Jun 14, 1985"),
        `date of birth shifted under TZ=${tz}`,
      ).toBeInTheDocument();
      expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
      unmount();
      process.env.TZ = previous;
    }
  });

  it("makes the email actionable", () => {
    renderRecord();
    expect(
      screen.getByRole("link", { name: "dawn@peregrine.local" }),
    ).toHaveAttribute("href", "mailto:dawn@peregrine.local");
  });

  it("keeps the line breaks in an address", () => {
    renderRecord({ address: "1 Airport Way\nBethel, AK 99559" });
    expect(screen.getByText(/1 Airport Way/)).toHaveClass("whitespace-pre-wrap");
  });

  it("shows the emergency contact when it is there", () => {
    renderRecord({
      emergency_contact_name: "Sam Whitfield",
      emergency_contact_relation: "Spouse",
      emergency_contact_phone: "907-555-0100",
    });
    expect(screen.getByText("Sam Whitfield")).toBeInTheDocument();
    expect(screen.getByText("Spouse")).toBeInTheDocument();
  });
});

describe("status and notes", () => {
  it("marks a terminated employee inactive", () => {
    renderRecord({ is_active: false, termination_date: "2026-05-01" });
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("May 1, 2026")).toBeInTheDocument();
  });

  it("shows notes only when there are some", () => {
    const { unmount } = renderRecord({ notes: "Seasonal — returns in May" });
    expect(screen.getByText("Seasonal — returns in May")).toBeInTheDocument();
    unmount();

    renderRecord();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("links back to the directory", () => {
    renderRecord();
    expect(screen.getByRole("link", { name: /Employees/ })).toHaveAttribute(
      "href",
      "/employees",
    );
  });
});
