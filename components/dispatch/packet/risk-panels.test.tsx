import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DispatchRisk } from "@/lib/api/dispatch-risk";

const { saveRiskInputsAction, refresh } = vi.hoisted(() => ({
  saveRiskInputsAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/risk-actions", () => ({ saveRiskInputsAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RiskAssessmentPanel } from "./risk-assessment-panel";
import {
  CompanyRiskInputs,
  ComplianceGatesInputs,
  DispatcherNotes,
  ManagementTriggers,
} from "./risk-inputs";

function risk(over: Partial<DispatchRisk> = {}): DispatchRisk {
  return {
    flight_id: "f-1",
    rows: [
      {
        factor: "Ceiling / Visibility",
        severity: 5,
        likelihood: 4,
        score: 20,
        level: "HIGH",
        comment: "worst route METAR vis≈1.8SM at PAEM; worst route METAR cig≈200ft at PAEM",
        source: "auto",
      },
      {
        factor: "Crosswind Component",
        severity: 3,
        likelihood: 3,
        score: 9,
        level: "MEDIUM",
        comment: "crosswind 24KT (limit 30 single-engine, near from 20)",
        source: "dispatcher",
      },
      {
        factor: "MEL/DMI Status",
        severity: null,
        likelihood: null,
        score: null,
        level: null,
        comment: "MEL/DMI=No / actions required=No",
        source: "auto",
      },
      {
        factor: "Management Approval Flag",
        severity: null,
        likelihood: null,
        score: null,
        level: null,
        comment: "REQUIRED",
        source: "auto",
      },
    ],
    max_score: 20,
    level: "HIGH",
    management_required: true,
    concerns: [
      "Ceiling / Visibility: worst route METAR vis≈1.8SM at PAEM; worst route METAR cig≈200ft at PAEM",
      "Focus airports: PABE (dep) and PAEM (dest)",
    ],
    summary: "Overall: HIGH (max score 20)\nKey drivers:\n• Ceiling / Visibility (score 20)",
    inputs: {
      flight_id: "f-1",
      outside_pilot_restrictions: false,
      vfr_mountain_night: false,
      management_approval_obtained: false,
      hazmat_approved: false,
      mel_actions_complete: false,
      reporting_override: null,
      night_override: null,
      crosswind_override_kt: 24,
      maintenance_override: null,
      mel_override: null,
      mel_actions_override: null,
      hazmat_override: null,
      non_certified_notes: null,
      dispatcher_notes: "Hold for the special.",
      area_forecast_product: null,
      updated_by: null,
      updated_at: null,
    },
    automatic: {
      reporting: { value: true, note: "reporting available (not in Stations: PAEM)" },
      night: { value: false, note: "" },
      crosswind_kt: 5,
      maintenance: { value: false, note: "100-hour due in 50.0 h" },
      mel: { value: false, note: "" },
      hazmat: { value: true, note: "1 hazmat item on the manifest" },
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveRiskInputsAction.mockResolvedValue({ ok: true });
});

describe("RiskAssessmentPanel (#50)", () => {
  it("shows the level, the concerns and each factor's score", () => {
    render(<RiskAssessmentPanel risk={risk()} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Overall dispatch risk: HIGHmax score 20Management approval required — not yet obtained",
    );
    expect(screen.getByText("Focus airports: PABE (dep) and PAEM (dest)")).toBeInTheDocument();
    const crosswind = screen.getByRole("rowheader", { name: "Crosswind Component" }).closest("tr")!;
    expect(within(crosswind).getByText("set by dispatcher")).toBeInTheDocument();
    expect(within(crosswind).getAllByText("3")).toHaveLength(2);
    const mel = screen.getByRole("rowheader", { name: "MEL/DMI Status" }).closest("tr")!;
    expect(within(mel).getAllByText("—")).toHaveLength(3);
    const management = screen.getByRole("rowheader", { name: "Management Approval Flag" }).closest("tr")!;
    expect(management.className).toContain("outline-status-red");
    expect(screen.getByText(/Key drivers:/)).toBeInTheDocument();
  });

  it("says why there's no matrix", () => {
    const { rerender } = render(<RiskAssessmentPanel risk={null} />);
    expect(screen.getByText("Pick a flight to score its risk matrix.")).toBeInTheDocument();
    rerender(<RiskAssessmentPanel risk={null} failed />);
    expect(screen.getByText(/couldn't be scored just now/)).toBeInTheDocument();
  });
});

describe("the risk inputs (#50)", () => {
  it("shows what the system worked out and saves an override", async () => {
    render(<CompanyRiskInputs flightId="f-1" risk={risk()} canEdit regions={[]} />);
    const night = screen.getByLabelText("Night Ops");
    expect(night).toHaveValue("auto");
    expect(within(night).getByRole("option", { name: "Auto (No)" })).toBeInTheDocument();
    expect(screen.getByText("reporting available (not in Stations: PAEM)")).toBeInTheDocument();

    fireEvent.change(night, { target: { value: "yes" } });
    await waitFor(() =>
      expect(saveRiskInputsAction).toHaveBeenCalledWith("f-1", { night_override: true }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("saves the crosswind on blur, and clearing it goes back to auto", async () => {
    render(<CompanyRiskInputs flightId="f-1" risk={risk()} canEdit regions={[]} />);
    const crosswind = screen.getByLabelText("Crosswind (kt)");
    expect(crosswind).toHaveValue(24);
    expect(crosswind).toHaveAttribute("placeholder", "auto: 5");
    fireEvent.change(crosswind, { target: { value: "" } });
    fireEvent.blur(crosswind);
    await waitFor(() =>
      expect(saveRiskInputsAction).toHaveBeenCalledWith("f-1", { crosswind_override_kt: null }),
    );
  });

  it("says when management approval is required and records it", async () => {
    render(<ManagementTriggers flightId="f-1" risk={risk()} canEdit />);
    expect(screen.getByText("Management approval required")).toBeInTheDocument();
    expect(screen.getByText("100-hour due in 50.0 h")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Mgmt approval obtained"));
    await waitFor(() =>
      expect(saveRiskInputsAction).toHaveBeenCalledWith("f-1", {
        management_approval_obtained: true,
      }),
    );
  });

  it("is read-only for anyone but a dispatcher or Exec Admin", () => {
    render(<ComplianceGatesInputs flightId="f-1" risk={risk()} canEdit={false} />);
    expect(screen.getByLabelText("Hazmat Flight")).toBeDisabled();
    expect(screen.getByLabelText("MEL/DMI pilot actions complete")).toBeDisabled();
    expect(screen.getByText("A dispatcher or Exec Admin sets these.")).toBeInTheDocument();
    expect(screen.getByText("1 hazmat item on the manifest")).toBeInTheDocument();
  });

  it("saves notes when the box is left, and shows a refusal", async () => {
    saveRiskInputsAction.mockResolvedValueOnce({
      ok: false,
      error: "Only a dispatcher or Exec Admin can change the risk inputs.",
    });
    render(<DispatcherNotes flightId="f-1" risk={risk()} canEdit />);
    const notes = screen.getByLabelText("Printed on the dispatch packet, as on the original.");
    expect(notes).toHaveValue("Hold for the special.");
    fireEvent.change(notes, { target: { value: "Hold for the 1700Z special." } });
    fireEvent.blur(notes);
    await waitFor(() =>
      expect(saveRiskInputsAction).toHaveBeenCalledWith("f-1", {
        dispatcher_notes: "Hold for the 1700Z special.",
      }),
    );
    expect(
      await screen.findByText("Only a dispatcher or Exec Admin can change the risk inputs."),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
