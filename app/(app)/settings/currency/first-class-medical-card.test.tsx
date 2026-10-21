import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComplianceSettings } from "@/lib/api/type-qualifications";

const { setFirstClassMedicalTypesAction } = vi.hoisted(() => ({
  setFirstClassMedicalTypesAction: vi.fn(),
}));
vi.mock("./actions", () => ({ setFirstClassMedicalTypesAction }));

import { FirstClassMedicalCard } from "./first-class-medical-card";

const FLEET = [
  { slug: "caravan", label: "Cessna 208 Caravan, Cessna 208B Grand Caravan" },
  { slug: "navajo", label: "Piper PA-31 Navajo" },
];
const NONE: ComplianceSettings = {
  enforce_type_qualifications: false,
  type_qualifications_changed_at: null,
  type_qualifications_changed_by: null,
  first_class_medical_types: [],
  first_class_medical_changed_at: null,
  first_class_medical_changed_by: null,
};
const NAVAJO: ComplianceSettings = {
  ...NONE,
  first_class_medical_types: ["navajo"],
  first_class_medical_changed_at: "2026-10-21T17:00:00Z",
  first_class_medical_changed_by: {
    id: "u-do",
    full_name: "Drew Director",
    email: "do@example.test",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FirstClassMedicalCard", () => {
  it("starts with nothing chosen and saves only after a change", async () => {
    setFirstClassMedicalTypesAction.mockResolvedValue({ ok: true });
    render(<FirstClassMedicalCard settings={NONE} fleetTypes={FLEET} canChange />);
    expect(screen.getByText("No aircraft chosen yet.")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /navajo/i }));
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(setFirstClassMedicalTypesAction).toHaveBeenCalledWith(["navajo"]),
    );
  });

  it("shows what is chosen and who chose it", () => {
    render(<FirstClassMedicalCard settings={NAVAJO} fleetTypes={FLEET} canChange />);
    expect(screen.getByRole("checkbox", { name: /navajo/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /caravan/i })).not.toBeChecked();
    expect(screen.getByText("Changed 2026-10-21, by Drew Director.")).toBeInTheDocument();
  });

  it("is read-only below the DO", () => {
    render(<FirstClassMedicalCard settings={NAVAJO} fleetTypes={FLEET} canChange={false} />);
    expect(screen.getByRole("checkbox", { name: /navajo/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(
      screen.getByText("The Director of Operations or an Exec Admin can change this."),
    ).toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    setFirstClassMedicalTypesAction.mockResolvedValue({
      ok: false,
      error: "Only the Director of Operations or an Exec Admin can change this.",
    });
    render(<FirstClassMedicalCard settings={NONE} fleetTypes={FLEET} canChange />);
    fireEvent.click(screen.getByRole("checkbox", { name: /caravan/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only the Director of Operations or an Exec Admin can change this.",
    );
  });

  it("keeps a chosen type listed after its last aircraft left, so it can be unticked", async () => {
    setFirstClassMedicalTypesAction.mockResolvedValue({ ok: true });
    render(
      <FirstClassMedicalCard
        settings={{ ...NAVAJO, first_class_medical_types: ["navajo", "ga8"] }}
        fleetTypes={FLEET}
        canChange
      />,
    );
    const gone = screen.getByRole("checkbox", { name: /ga8/i });
    expect(gone).toBeChecked();
    expect(screen.getByText("No aircraft in the fleet now")).toBeInTheDocument();
    fireEvent.click(gone);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(setFirstClassMedicalTypesAction).toHaveBeenCalledWith(["navajo"]),
    );
  });
});
