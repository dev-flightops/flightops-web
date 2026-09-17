import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  ChecklistItem,
  ChecklistResponse,
  DocumentRequirementRow,
} from "@/lib/api/employee-documents";

// The drawer is a client component on useTransition + a server action;
// stubbed so this file stays about what the checklist SAYS.
vi.mock("./upload-document-drawer", () => ({
  UploadDocumentDrawer: ({ employeeId }: { employeeId: string }) => (
    <div data-testid="upload-drawer" data-employee={employeeId} />
  ),
}));

import { DocumentsPanel } from "./documents-panel";

/**
 * The Documents tab.
 *
 * What is worth pinning is the wording, because every state here is a
 * claim about somebody's paperwork. "Missing" and "no expiry recorded"
 * are different problems, "does not expire" and "expiry unknown" are
 * different facts, and a date on screen is the only thing that makes
 * "expiring" mean anything.
 */

function requirement(
  over: Partial<DocumentRequirementRow> = {},
): DocumentRequirementRow {
  return {
    id: "r-1",
    name: "Medical Certificate",
    description: null,
    applies_to_roles: [],
    required_on_hire: false,
    has_expiry: true,
    reminder_days: 30,
    sort_order: 100,
    is_active: true,
    ...over,
  };
}

function item(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    requirement: requirement(),
    state: "missing",
    days_to_expiry: null,
    current: null,
    superseded: [],
    ...over,
  };
}

function uploaded(over = {}) {
  return {
    id: "d-1",
    requirement_id: "r-1",
    original_filename: "medical.pdf",
    content_type: "application/pdf",
    size_bytes: 1024,
    issued_on: null,
    expires_on: null,
    notes: null,
    uploaded_by_user_id: "u-9",
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function panel(
  items: ChecklistItem[],
  over: Partial<ChecklistResponse> = {},
  canUpload = true,
) {
  const checklist: ChecklistResponse = {
    employee_id: "u-1",
    employee_name: "Dawn Whitfield",
    as_of: "2026-09-17",
    items,
    outstanding: items.filter((i) => i.state !== "on_file").length,
    ...over,
  };
  return render(
    <DocumentsPanel
      employeeId="u-1"
      checklist={checklist}
      canUpload={canUpload}
      loadError={null}
    />,
  );
}

describe("the summary line", () => {
  it("names how many need attention", () => {
    panel([item(), item({ requirement: requirement({ id: "r-2" }), state: "on_file", current: uploaded() })]);
    expect(screen.getByText(/1 of 2 needing attention/)).toBeInTheDocument();
  });

  it("says all on file when nothing is outstanding", () => {
    panel([item({ state: "on_file", current: uploaded() })]);
    expect(screen.getByText(/All 1 on file/)).toBeInTheDocument();
  });

  it("always shows the date the states were computed against", () => {
    // "Expiring" only means anything relative to a day. A reader on a
    // stale tab should not have to guess which today it meant.
    panel([item()]);
    expect(screen.getByText(/as of 2026-09-17/)).toBeInTheDocument();
  });
});

describe("nothing required", () => {
  it("says the requirements list is empty, not the employee's file", () => {
    // These are different statements. "No documents" would read as a
    // problem with this person.
    panel([]);
    expect(
      screen.getByText(/Nothing is required of this employee/),
    ).toBeInTheDocument();
  });

  it("offers no upload when there is nothing to file against", () => {
    panel([]);
    expect(screen.queryByTestId("upload-drawer")).not.toBeInTheDocument();
  });
});

describe("each state says something different", () => {
  it("missing", () => {
    panel([item({ state: "missing" })]);
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText(/Nothing on file/)).toBeInTheDocument();
  });

  it("on file with no expiry at all", () => {
    panel([
      item({
        requirement: requirement({ has_expiry: false }),
        state: "on_file",
        current: uploaded(),
      }),
    ]);
    expect(
      screen.getByText(/does not expire/),
    ).toBeInTheDocument();
  });

  it("undated — on file, expiry wanted, none captured", () => {
    // The row LOOKS satisfied: there is a file against it. So it gets
    // its own badge and an explicit line, because "on file" here would
    // read as current forever.
    panel([item({ state: "undated", current: uploaded() })]);
    expect(screen.getByText("No expiry recorded")).toBeInTheDocument();
    expect(
      screen.getByText(/cannot be checked/),
    ).toBeInTheDocument();
  });

  it("expiring, naming the window it fell inside", () => {
    panel([
      item({
        state: "expiring",
        days_to_expiry: 12,
        current: uploaded({ expires_on: "2026-09-29" }),
      }),
    ]);
    expect(screen.getByText("Expiring")).toBeInTheDocument();
    expect(
      screen.getByText(/12 days away \(inside the 30-day warning\)/),
    ).toBeInTheDocument();
  });

  it("expiring today, rather than in 0 days", () => {
    panel([
      item({
        state: "expiring",
        days_to_expiry: 0,
        current: uploaded({ expires_on: "2026-09-17" }),
      }),
    ]);
    expect(screen.getByText(/Expires today/)).toBeInTheDocument();
  });

  it("expired, saying how long ago", () => {
    panel([
      item({
        state: "expired",
        days_to_expiry: -4,
        current: uploaded({ expires_on: "2026-09-13" }),
      }),
    ]);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText(/4 days ago/)).toBeInTheDocument();
  });

  it("uses the singular for one day", () => {
    panel([
      item({
        state: "expired",
        days_to_expiry: -1,
        current: uploaded({ expires_on: "2026-09-16" }),
      }),
    ]);
    expect(screen.getByText(/1 day ago/)).toBeInTheDocument();
  });
});

describe("the file", () => {
  it("links the current document at the auth-proxying route", () => {
    // <a href> cannot carry a Bearer header, so downloads go through
    // the Next route handler.
    panel([item({ state: "on_file", current: uploaded() })]);
    expect(
      screen.getByRole("link", { name: "medical.pdf" }),
    ).toHaveAttribute("href", "/api/employee-documents/d-1/download");
  });

  it("says no file rather than leaving the column blank", () => {
    panel([item({ state: "missing" })]);
    expect(screen.getByText("No file")).toBeInTheDocument();
  });

  it("keeps earlier uploads as history, collapsed", () => {
    // Uploads are additive on the service: a renewal is a new row, so
    // these are the record of what was on file, not duplicates to
    // chase.
    panel([
      item({
        state: "on_file",
        current: uploaded({ id: "d-2", original_filename: "medical-2027.pdf" }),
        superseded: [uploaded({ id: "d-1", expires_on: "2026-01-01" })],
      }),
    ]);
    expect(screen.getByText(/1 earlier upload/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "medical.pdf" }),
    ).toHaveAttribute("href", "/api/employee-documents/d-1/download");
  });
});

describe("required on hire", () => {
  it("is marked, because the operator flagged it", () => {
    panel([item({ requirement: requirement({ required_on_hire: true }) })]);
    expect(screen.getByText("On hire")).toBeInTheDocument();
  });

  it("is not marked when it was not flagged", () => {
    panel([item()]);
    expect(screen.queryByText("On hire")).not.toBeInTheDocument();
  });
});

describe("who can upload", () => {
  it("offers the drawer to an exec admin", () => {
    panel([item()], {}, true);
    expect(screen.getByTestId("upload-drawer")).toBeInTheDocument();
  });

  it("withholds it from somebody reading their own file", () => {
    // Reading your own record does not let you file your own medical.
    panel([item()], {}, false);
    expect(screen.queryByTestId("upload-drawer")).not.toBeInTheDocument();
  });
});

describe("when the checklist could not be loaded", () => {
  it("says so instead of rendering an empty list", () => {
    // An empty checklist reads as "nothing is required", which is a
    // different claim from "we could not ask".
    render(
      <DocumentsPanel
        employeeId="u-1"
        checklist={null}
        canUpload
        loadError="You do not have access to this employee's documents."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /do not have access/,
    );
    expect(screen.queryByText(/Nothing is required/)).not.toBeInTheDocument();
  });
});

describe("ordering", () => {
  it("renders the service's order rather than re-sorting", () => {
    // The service sorts by urgency then name. Re-sorting here would be
    // a second, drifting opinion about which state matters most.
    panel([
      item({ requirement: requirement({ id: "r-1", name: "Zebra" }), state: "expired", days_to_expiry: -2, current: uploaded({ expires_on: "2026-09-15" }) }),
      item({ requirement: requirement({ id: "r-2", name: "Alpha" }), state: "on_file", current: uploaded() }),
    ]);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Zebra")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Alpha")).toBeInTheDocument();
  });
});
