import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests run React 18, which has no useActionState: stand it in with a
// state each test can set.
const actionState = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [actionState.current ?? initial, () => {}, false],
}));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {}, apiFetch: vi.fn() }));
vi.mock("./actions", () => ({
  savePaxAction: vi.fn(),
  saveFreightAction: vi.fn(),
  removeLineAction: vi.fn(),
  createManifestAction: vi.fn(),
  lockManifestAction: vi.fn(),
}));

import type { ManifestCargoRow, ManifestPaxRow } from "@/lib/api/manifest";

import { FreightSection } from "./freight-section";
import { PassengersSection } from "./pax-section";

const FLIGHT = "6b0f6a3e-2c1d-4e5f-8a9b-0c1d2e3f4a5b";

function pax(over: Partial<ManifestPaxRow> = {}): ManifestPaxRow {
  return {
    id: "p-1",
    manifest_id: "m-1",
    first_name: "Ann",
    last_name: "Quill",
    weight_lbs: "152.0",
    baggage_lbs: "20.0",
    seat_number: "1A",
    ticket_type: "revenue",
    is_crew: false,
    is_unaccompanied_minor: false,
    contact_phone: null,
    contact_email: "ann@example.test",
    notes: null,
    ...over,
  };
}

function line(over: Partial<ManifestCargoRow> = {}): ManifestCargoRow {
  return {
    id: "c-1",
    manifest_id: "m-1",
    description: "Freight",
    weight_lbs: "120.0",
    pieces: 1,
    mail_class: null,
    is_hazmat: false,
    hazmat_notes: null,
    shipper: null,
    consignee: null,
    tracking_number: null,
    notes: null,
    ...over,
  };
}

const hidden = (form: HTMLElement, name: string) =>
  (form.querySelector(`input[type=hidden][name=${name}]`) as HTMLInputElement | null)?.value;

beforeEach(() => {
  actionState.current = undefined;
});

describe("Passengers & Crew (#62)", () => {
  const rows = [pax(), pax({ id: "p-2", first_name: "Sam", last_name: "Ito", seat_number: null, is_crew: true })];

  it("opens an empty add form for the flight, and closes it again", () => {
    render(<PassengersSection flightId={FLIGHT} rows={rows} editable />);
    expect(screen.getByText("1 pax · 1 crew")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ Add Passenger" }));
    const form = screen.getByRole("form", { name: "Add passenger" });
    expect(hidden(form, "flight_id")).toBe(FLIGHT);
    expect(hidden(form, "pax_id")).toBe("");
    expect((within(form).getByLabelText("First Name *") as HTMLInputElement).value).toBe("");
    expect((within(form).getByLabelText("Baggage (lbs)") as HTMLInputElement).value).toBe("0");
    fireEvent.click(within(form).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("form", { name: "Add passenger" })).toBeNull();
  });

  it("edits a passenger in a form holding what is on the manifest", () => {
    render(<PassengersSection flightId={FLIGHT} rows={rows} editable />);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const form = screen.getByRole("form", { name: "Edit Ann Quill" });
    expect(hidden(form, "pax_id")).toBe("p-1");
    expect((within(form).getByLabelText("Weight (lbs) *") as HTMLInputElement).value).toBe("152");
    expect((within(form).getByLabelText("Email") as HTMLInputElement).value).toBe("ann@example.test");
    expect((within(form).getByLabelText("Crew member") as HTMLInputElement).checked).toBe(false);
  });

  it("shows a refusal with the passenger as typed", () => {
    actionState.current = {
      status: "error",
      message: "Enter the passenger's weight.",
      values: { first_name: "Nora", last_name: "Lee", weight_lbs: "", is_crew: "on" },
      attempt: 1,
    };
    render(<PassengersSection flightId={FLIGHT} rows={rows} editable />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Passenger" }));
    const form = screen.getByRole("form", { name: "Add passenger" });
    expect(within(form).getByRole("alert").textContent).toBe("Enter the passenger's weight.");
    expect((within(form).getByLabelText("First Name *") as HTMLInputElement).value).toBe("Nora");
    expect((within(form).getByLabelText("Crew member") as HTMLInputElement).checked).toBe(true);
  });

  it("asks before removing, naming who goes", () => {
    render(<PassengersSection flightId={FLIGHT} rows={rows} editable />);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.getByText("Remove Ann Quill?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.queryByText("Remove Ann Quill?")).toBeNull();
  });

  it("offers nothing to change on a locked manifest", () => {
    render(<PassengersSection flightId={FLIGHT} rows={rows} editable={false} />);
    expect(screen.queryByRole("button", { name: "+ Add Passenger" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.getByText("Quill")).toBeTruthy();
  });
});

describe("USPS Mail and Cargo & Freight (#62)", () => {
  it("adds mail with legacy's fields: class, weight, pieces, notes", () => {
    render(<FreightSection flightId={FLIGHT} kind="mail" rows={[]} editable />);
    expect(screen.getByText("No mail on this manifest.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ Add Mail" }));
    const form = screen.getByRole("form", { name: "Add Mail" });
    expect(hidden(form, "kind")).toBe("mail");
    expect((within(form).getByLabelText("Mail Class *") as HTMLSelectElement).value).toBe("bypass_mail");
    expect(within(form).queryByLabelText("Description *")).toBeNull();
    expect(within(form).queryByLabelText("Tracking / Waybill")).toBeNull();
  });

  it("carries a mail line's description and class into its edit, so the action can keep or re-derive it", () => {
    const mail = line({ id: "c-9", description: "USPS mail — Anchorage sort", mail_class: "priority_mail", pieces: 3 });
    render(<FreightSection flightId={FLIGHT} kind="mail" rows={[mail]} editable />);
    expect(screen.getByText("Priority Mail")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("form", { name: "Edit Mail" });
    expect(hidden(form, "current_description")).toBe("USPS mail — Anchorage sort");
    expect(hidden(form, "current_mail_class")).toBe("priority_mail");
    expect((within(form).getByLabelText("Pieces") as HTMLInputElement).value).toBe("3");
  });

  it("edits cargo, hazmat and tracking included", () => {
    const freight = line({
      description: "UPS package",
      tracking_number: "1Z999",
      is_hazmat: true,
      hazmat_notes: "Class 9",
      shipper: "Depot",
      consignee: "Clinic",
    });
    render(<FreightSection flightId={FLIGHT} kind="cargo" rows={[freight]} editable />);
    expect(screen.getByText("Depot → Clinic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("form", { name: "Edit UPS package" });
    expect(hidden(form, "cargo_id")).toBe("c-1");
    expect((within(form).getByLabelText("Tracking / Waybill") as HTMLInputElement).value).toBe("1Z999");
    expect((within(form).getByLabelText("Hazardous materials") as HTMLInputElement).checked).toBe(true);
    expect((within(form).getByLabelText("HazMat Class / Notes") as HTMLInputElement).value).toBe("Class 9");
  });
});
