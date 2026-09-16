import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  AirmanRecordResponse,
  DisqualificationListResponse,
  UserResponse,
} from "@/lib/api/types";

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
    // "Not built", not "Soon". None of the three is on M4's story list,
    // and each is a subsystem rather than a screen, so "Soon" was a
    // commitment nothing backs.
    expect(screen.getAllByText("Not built")).toHaveLength(3);
    expect(screen.queryByText("Soon")).not.toBeInTheDocument();
  });

  it("says in the tooltip that they are not scheduled either", () => {
    renderForm();
    expect(screen.getByText("Documents").closest("span")).toHaveAttribute(
      "title",
      expect.stringContaining("not currently scheduled"),
    );
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

describe("the form is remounted when a save completes", () => {
  /**
   * WHAT THIS GUARDS, AND WHY IT IS NOT THE OBVIOUS TEST
   *
   * The bug: React resets the form's DOM once a real action completes.
   * Controlled text inputs survive it — React restores their value —
   * but the two `<select>`s here went blank while the record still
   * held values. Because the action sends every field it owns and
   * treats blank as "clear", the next Save wiped Department and
   * Employment type from a record that had just been filled in.
   *
   * That reset cannot be reproduced here: the harness passes a plain
   * function as `action`, which React 18 does not treat as a form
   * action at all (it warns about the prop), so no reset happens and
   * a test that drifts a select's value then re-renders passes with or
   * without the fix. It was written that way first and did not
   * discriminate — the incomplete version of this fix passed it.
   *
   * So what is asserted is the mechanism the browser fix relies on:
   * the form is a NEW DOM node after a save completes, which is what
   * re-initialises every field — selects included — from state.
   * Browser verification of the effect itself is in the PR.
   */
  const formNode = () =>
    document.querySelector('form[class*="space-y"]') as HTMLFormElement;

  function finishSave(
    rerender: (ui: React.ReactElement) => void,
    over: Partial<UserResponse>,
    state: SaveEmployeeState = { status: "idle" },
  ) {
    const props = (pending: boolean) => (
      <EmployeeRecordForm
        employee={employee(over)}
        state={state}
        action={noop}
        pending={pending}
      />
    );
    rerender(props(true));
    rerender(props(false));
  }

  it("remounts the form", () => {
    const over = { department: "Operations" };
    const { rerender } = renderForm(over);
    const first = formNode();
    finishSave(rerender, over);
    expect(formNode()).not.toBe(first);
  });

  it("remounts again on a second save of an unchanged record", () => {
    // The case the first attempt at this fix missed. Saving a record
    // whose values did not change leaves the stored record identical,
    // so a key derived from the record alone does not change, the form
    // is not remounted, and a blanked select survives into the next
    // submit.
    const over = { department: "Maintenance" };
    const { rerender } = renderForm(over);
    let node = formNode();
    for (const pass of [1, 2, 3]) {
      finishSave(rerender, over);
      const next = formNode();
      expect(next, `pass ${pass}`).not.toBe(node);
      node = next;
    }
  });

  it("does not remount while the save is still in flight", () => {
    // Remounting mid-submit would throw away the pending form.
    const over = { department: "Operations" };
    const { rerender } = renderForm(over);
    const first = formNode();
    rerender(
      <EmployeeRecordForm
        employee={employee(over)}
        state={{ status: "idle" }}
        action={noop}
        pending={true}
      />,
    );
    expect(formNode()).toBe(first);
  });

  it("keeps an in-progress edit across the remount", () => {
    // The remount re-initialises from state, which still holds what
    // the operator chose. A rejected save is something to correct, not
    // something to retype.
    const over = { department: "Operations" };
    const { rerender } = renderForm(over);
    fireEvent.change(screen.getByLabelText(/Department/), {
      target: { value: "Training" },
    });
    finishSave(rerender, over, { status: "error", error: "nope" });
    expect(
      (screen.getByLabelText(/Department/) as HTMLSelectElement).value,
    ).toBe("Training");
  });
});

describe("certifications on the employee record", () => {
  /**
   * The 135.63 certificate record existed but was only rendered under
   * /compliance/pilots/{id}, so an HR reader opening an employee saw no
   * certifications at all — for a pilot whose certificate and medical
   * class were on file two clicks away.
   *
   * Three states, and the third is the one worth pinning: a ramp agent
   * has no airman certificate, and an empty Certifications card on
   * their record would read as missing data rather than as not
   * applicable.
   */
  function airmanRecord(
    over: Partial<AirmanRecordResponse> = {},
  ): AirmanRecordResponse {
    return {
      pilot: { id: "u-1", full_name: "Dawn Whitfield", email: "d@x.test" },
      certificate_type: "commercial",
      certificate_number: "1234567",
      ratings: [],
      medical_class: "second",
      total_time_hours: null,
      pic_time_hours: null,
      cross_country_hours: null,
      night_hours: null,
      instrument_hours: null,
      experience_as_of: null,
      notes: null,
      ...over,
    };
  }

  const noDisqualifications: DisqualificationListResponse = {
    items: [],
    open_count: 0,
  };

  function renderWith(
    over: Partial<UserResponse>,
    airman: AirmanRecordResponse | null,
    disqualifications: DisqualificationListResponse | null = noDisqualifications,
  ) {
    return render(
      <EmployeeRecordForm
        employee={employee(over)}
        airman={airman}
        disqualifications={disqualifications}
        state={{ status: "idle" }}
        action={noop}
        pending={false}
      />,
    );
  }

  it("shows the certificate on a pilot who has a record", () => {
    renderWith({ roles: ["pilot"] }, airmanRecord());
    expect(screen.getByText("1234567")).toBeInTheDocument();
  });

  it("offers the way through to currency, which this page does not answer", () => {
    renderWith({ roles: ["pilot"] }, airmanRecord());
    expect(
      screen.getByRole("link", { name: /Currency and disqualifications/ }),
    ).toHaveAttribute("href", "/compliance/pilots/u-1");
  });

  it("says a pilot has no record yet rather than showing an empty card", () => {
    renderWith({ roles: ["pilot"] }, null);
    expect(screen.getByText(/No certificate or medical details recorded/)).toBeInTheDocument();
  });

  it("treats the empty shell the API returns as nothing on file", () => {
    // `get_airman_record` never 404s — it documents that "a pilot with
    // none yet returns empty fields rather than a 404". Rendering the
    // card for that shell gives eight rows reading "Not recorded",
    // which looks like the system lost something it was holding.
    renderWith(
      { roles: ["pilot"] },
      airmanRecord({
        certificate_type: null,
        certificate_number: null,
        medical_class: null,
      }),
    );
    expect(
      screen.getByText(/No certificate or medical details recorded/),
    ).toBeInTheDocument();
  });

  it("renders nothing at all for someone who holds no flight-crew role", () => {
    // A ramp agent has no airman certificate. An empty Certifications
    // section on their record would read as missing data.
    // The API returns a shell for any user id, so this is the realistic
    // input — gating on the response rather than the role put a
    // 14 CFR 135.63 card on a ramp agent's record.
    renderWith({ roles: ["ground_ops"] }, airmanRecord());
    expect(screen.queryByText(/airman record/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Certifications" }),
    ).not.toBeInTheDocument();
  });

  it("covers a chief pilot and a check airman, not just pilot", () => {
    for (const role of ["chief_pilot", "check_airman"]) {
      const { unmount } = renderWith({ roles: [role] }, null);
      expect(
        screen.getByText(/No certificate or medical details recorded/),
        role,
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("withholds the card when the disqualification feed failed", () => {
    // The card counts open disqualifications. Rendering it with a
    // fabricated empty list would report "none" for a feed that did not
    // load, which is a different claim about eligibility to fly.
    renderWith({ roles: ["pilot"] }, airmanRecord(), null);
    expect(
      screen.getByText(/disqualification history could not be loaded/),
    ).toBeInTheDocument();
    expect(screen.queryByText("1234567")).not.toBeInTheDocument();
  });
});
