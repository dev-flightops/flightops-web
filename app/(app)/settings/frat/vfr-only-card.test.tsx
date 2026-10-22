import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComplianceSettings } from "@/lib/api/type-qualifications";

const { setVfrOnlyTypesAction } = vi.hoisted(() => ({ setVfrOnlyTypesAction: vi.fn() }));
vi.mock("./actions", () => ({ setVfrOnlyTypesAction }));

import { VfrOnlyCard } from "./vfr-only-card";

const FLEET = [
  { slug: "c207", label: "Cessna 207" },
  { slug: "caravan", label: "Cessna 208 Caravan" },
  { slug: "ga8", label: "GippsAero GA8 Airvan" },
];
const SETTINGS: ComplianceSettings = {
  enforce_type_qualifications: false,
  type_qualifications_changed_at: null,
  type_qualifications_changed_by: null,
  first_class_medical_types: [],
  first_class_medical_changed_at: null,
  first_class_medical_changed_by: null,
  vfr_only_types: [],
  vfr_only_changed_at: null,
  vfr_only_changed_by: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VfrOnlyCard (#89)", () => {
  it("says what release does with these types, with the company's minimums", () => {
    render(
      <VfrOnlyCard
        settings={SETTINGS}
        fleetTypes={FLEET}
        canChange
        minimums={{ ceilingFt: 600, visibilitySm: 2 }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Aircraft not IFR certified" })).toBeInTheDocument();
    expect(
      screen.getByText(/ceiling is below 600 ft or the visibility below 2 sm/),
    ).toBeInTheDocument();
  });

  it("saves the 207 and the Airvan", async () => {
    setVfrOnlyTypesAction.mockResolvedValue({ ok: true });
    render(
      <VfrOnlyCard
        settings={SETTINGS}
        fleetTypes={FLEET}
        canChange
        minimums={{ ceilingFt: 600, visibilitySm: 2 }}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /c207/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /ga8/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(setVfrOnlyTypesAction).toHaveBeenCalledWith(["c207", "ga8"]));
  });

  it("shows nothing chosen when the backend does not send the list yet", () => {
    const older = { ...SETTINGS } as Partial<ComplianceSettings>;
    delete older.vfr_only_types;
    render(
      <VfrOnlyCard
        settings={older as ComplianceSettings}
        fleetTypes={FLEET}
        canChange={false}
        minimums={{ ceilingFt: 600, visibilitySm: 2 }}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /c207/i })).not.toBeChecked();
    expect(screen.getByText("No aircraft chosen yet.")).toBeInTheDocument();
  });
});
