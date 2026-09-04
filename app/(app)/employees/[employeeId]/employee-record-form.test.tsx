import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UserResponse } from "@/lib/api/types";

import type { SaveEmployeeState } from "./actions";
import { EmployeeRecordForm } from "./employee-record-form";

/**
 * The employee record form, laid out to follow legacy's /employees/{id}.
 *
 * This started as a read-only panel and Greg asked for the legacy shape —
 * an editable form, stacked cards, three fields to a row. So the
 * assertions are about a form now: what a field is populated with, what
 * gets submitted, and what is deliberately not editable here.
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

const noop = () => {};

function renderForm(
  over: Partial<UserResponse> = {},
  state: SaveEmployeeState = { status: "idle" },
  pending = false,
) {
  return render(
    <EmployeeRecordForm
      employee={employee(over)}
      state={state}
      action={noop}
      pending={pending}
    />,
  );
}

const field = (label: RegExp | string) =>
  screen.getByLabelText(label) as HTMLInputElement;

/** "Phone" exists in both Contact and Emergency contact, so those two
 *  have to be asked for by section. */
const inSection = (name: string) =>
  within(screen.getByRole("region", { name }));

describe("the form is populated from the record", () => {
  it("fills every text field it has a value for", () => {
    renderForm({
      first_name: "Dana",
      last_name: "Whitfield",
      preferred_name: "Dee",
      emp_number: "PGR-114",
      title: "Lead Dispatcher",
      station: "ANC",
      phone: "907-555-0142",
      emergency_contact_name: "Sam Whitfield",
    });
    expect(field("First name").value).toBe("Dana");
    expect(field("Preferred name").value).toBe("Dee");
    expect(field("Employee number").value).toBe("PGR-114");
    expect(field("Home station").value).toBe("ANC");
    expect(
      (inSection("Contact").getByLabelText("Phone") as HTMLInputElement).value,
    ).toBe("907-555-0142");
    expect(
      (
        inSection("Emergency Contact").getByLabelText(
          "Name",
        ) as HTMLInputElement
      ).value,
    ).toBe("Sam Whitfield");
  });

  it("leaves an unset field as an empty input, not the word None", () => {
    // The read-only version said "Not recorded". A form says it with an
    // empty box, and putting words in one would submit them as the value.
    renderForm();
    expect(field("First name").value).toBe("");
    expect(screen.queryByText("Not recorded")).not.toBeInTheDocument();
  });

  it("hands dates to the date input unparsed", () => {
    // The API speaks ISO days and so does <input type="date">, so the
    // value passes straight through. No parsing means no zone to get
    // wrong — which is the bug this repo keeps hitting.
    renderForm({ date_of_birth: "1985-06-14", hire_date: "2024-01-15" });
    expect(field("Date of birth").value).toBe("1985-06-14");
    expect(field("Hire date").value).toBe("2024-01-15");
    expect(field("Date of birth").type).toBe("date");
  });

  it("selects the employment type and department already on file", () => {
    renderForm({
      employment_type: "part_time" as never,
      department: "Maintenance",
    });
    expect(
      (screen.getByLabelText("Employment type") as HTMLSelectElement).value,
    ).toBe("part_time");
    expect(
      (screen.getByLabelText("Department") as HTMLSelectElement).value,
    ).toBe("Maintenance");
  });

  it("offers an empty option so a set value can be cleared", () => {
    // Without one, a department chosen by mistake could never be undone.
    renderForm({ department: "Maintenance" });
    const select = screen.getByLabelText("Department") as HTMLSelectElement;
    expect([...select.options].some((o) => o.value === "")).toBe(true);
  });

  it("caps the station at the four characters the column holds", () => {
    renderForm();
    expect(field("Home station").maxLength).toBe(4);
  });
});

describe("what is deliberately not editable", () => {
  it("shows the email but does not let this form change it", () => {
    // It is the login identity, checked for uniqueness in user
    // management. Editing it here could leave two people sharing one.
    renderForm();
    expect(screen.getByText("dawn@peregrine.local")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });
});

describe("the tab bar", () => {
  it("marks Profile as the page you are on", () => {
    renderForm();
    expect(screen.getByText("Profile")).toHaveAttribute("aria-current", "page");
  });

  it("shows the other three as not built rather than hiding them", () => {
    // Dropping them would hide that the record has more to it; linking
    // them would give three 404s, since they belong to modules we have
    // not built.
    renderForm();
    for (const label of ["Documents", "Onboarding", "Drug & Alcohol"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Soon")).toHaveLength(3);
  });

  it("does not make the unbuilt tabs clickable", () => {
    renderForm();
    for (const label of ["Documents", "Onboarding", "Drug & Alcohol"]) {
      expect(
        screen.queryByRole("link", { name: label }),
      ).not.toBeInTheDocument();
    }
  });
});

describe("naming and status", () => {
  it("uses the name the person goes by", () => {
    renderForm({ preferred_name: "Dee" });
    expect(screen.getByRole("heading", { name: "Dee" })).toBeInTheDocument();
  });

  it("falls back to the full name, ignoring whitespace", () => {
    renderForm({ preferred_name: "   " });
    expect(
      screen.getByRole("heading", { name: "Dawn Whitfield" }),
    ).toBeInTheDocument();
  });

  it("summarises the employment details it has", () => {
    renderForm({ emp_number: "PGR-114", department: "Ops", title: "Lead" });
    expect(screen.getByText("PGR-114 · Ops · Lead")).toBeInTheDocument();
  });

  it("says so when there are none", () => {
    renderForm();
    expect(
      screen.getByText("No employment details recorded"),
    ).toBeInTheDocument();
  });

  it("marks a terminated employee inactive", () => {
    renderForm({ is_active: false });
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});

describe("saving", () => {
  it("carries the employee id so the action knows who it is saving", () => {
    const { container } = renderForm();
    const hidden = container.querySelector('input[name="employee_id"]');
    expect(hidden).toHaveValue("u-1");
  });

  it("reports a failure", () => {
    renderForm(
      {},
      { status: "error", error: "Date of birth has to be in the past." },
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Date of birth has to be in the past.",
    );
  });

  it("leaves the fields alone when an error comes back", () => {
    // Weaker than it looks, and deliberately named for what it does
    // check. The bug behind the controlled fields — React resetting an
    // uncontrolled form once its action settles, which threw away every
    // edit when one date was rejected — cannot be reproduced here:
    // React 18 does not accept a function as <form action>, so no form
    // action ever settles under vitest. That path is browser-verified.
    //
    // What this does hold is the neighbouring regression: rendering the
    // error banner must not itself clear the form.
    const rendered = renderForm({ title: "Lead Dispatcher" });
    fireEvent.change(field("Job title"), {
      target: { value: "Chief Dispatcher" },
    });

    rendered.rerender(
      <EmployeeRecordForm
        employee={employee({ title: "Lead Dispatcher" })}
        state={{
          status: "error",
          error: "Date of birth has to be in the past.",
        }}
        action={noop}
        pending={false}
      />,
    );

    expect(field("Job title").value).toBe("Chief Dispatcher");
  });

  it("adopts the record the server kept once a save lands", () => {
    // The successful save revalidates the page, so a new record arrives
    // as a prop. Anything the server normalised on the way in — the
    // action trims, so the trailing spaces here — has to win over what
    // is still sitting in the form's state.
    const rendered = renderForm({ first_name: null });
    fireEvent.change(field("First name"), { target: { value: "Dana  " } });

    rendered.rerender(
      <EmployeeRecordForm
        employee={employee({ first_name: "Dana" })}
        state={{ status: "saved" }}
        action={noop}
        pending={false}
      />,
    );

    expect(field("First name").value).toBe("Dana");
  });

  it("confirms a save", () => {
    renderForm({}, { status: "saved" });
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("shows neither banner before anything has been submitted", () => {
    renderForm();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables the button while a save is in flight", () => {
    // Double-submitting a PATCH is harmless here, but the button going
    // dead is how the user knows the click registered.
    renderForm({}, { status: "idle" }, true);
    const button = screen.getByRole("button", { name: /Saving/ });
    expect(button).toBeDisabled();
  });

  it("offers a way out that does not save", () => {
    renderForm();
    const cancel = screen.getByRole("link", { name: "Cancel" });
    expect(cancel).toHaveAttribute("href", "/employees");
  });
});

describe("layout follows the legacy page", () => {
  it("stacks the same five cards legacy does, in the same order", () => {
    renderForm();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Identity",
      "Employment",
      "Contact",
      "Emergency Contact",
      // Legacy gives notes their own card rather than tacking them onto
      // the emergency contact, and shows no title on it — so the heading
      // is present for the region and hidden on screen.
      "Notes",
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "Notes" })).toHaveClass(
      "sr-only",
    );
  });

  it("puts three fields to a row, as legacy does", () => {
    const { container } = renderForm();
    const identity = screen
      .getByRole("heading", { level: 2, name: "Identity" })
      .closest("section")!;
    const grid = identity.querySelector(".grid");
    expect(grid?.className).toMatch(/sm:grid-cols-3/);
    expect(container.querySelectorAll("section").length).toBe(5);
  });

  it("keeps the long fields on their own full-width row", () => {
    // Address and notes are prose; squeezing them into a third of a row
    // is why the legacy page gives them the full width.
    renderForm();
    expect(screen.getByLabelText("Address").parentElement?.className).toMatch(
      /col-span-3/,
    );
    // Scoped to the card: the hidden heading names the region "Notes"
    // too, so an unscoped lookup matches both it and the textarea.
    const notes = inSection("Notes").getByLabelText("Notes");
    expect(notes.parentElement?.className).toMatch(/col-span-3/);
  });
});
