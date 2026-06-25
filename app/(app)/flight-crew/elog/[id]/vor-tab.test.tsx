import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./vor-actions", () => ({
  updateVorCheckAction: vi.fn(),
}));

import { VorTab } from "./vor-tab";
import type { FlightLogResponse } from "@/lib/api/types";

function makeLog(over: Partial<FlightLogResponse> = {}): FlightLogResponse {
  return {
    id: "log-1",
    log_number: "LOG-20260615-150000",
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "C208",
      seats: 9,
      airframe_type: "caravan",
    },
    flight_id: null,
    flight_number: null,
    flight_type: "advisory",
    flight_date: "2026-06-15",
    status: "draft",
    is_manual_entry: false,
    created_by: { id: "u-1", full_name: "Pilot", email: "p@x.test" },
    created_at: "2026-06-15T12:00:00Z",
    vor_identifier: null,
    vor_check_type: null,
    vor_station_facility: null,
    vor_location: null,
    vor_bearing_indicated: null,
    vor_bearing_known: null,
    vor_error_degrees: null,
    vor_checked_at: null,
    vor_certified: false,
    ...over,
  };
}

describe("VorTab", () => {
  it("renders the 91.171 heading + every input + the cert checkbox", () => {
    render(<VorTab log={makeLog()} />);
    expect(
      screen.getByText(/VOR 30-Day Check \(FAR 91\.171\)/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/VOR Identifier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Check Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Station/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bearing Indicated/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bearing Known/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date & Time/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/I certify this VOR check is accurate/i),
    ).toBeInTheDocument();
  });

  it("shows the IFR-required hint when flight_type === 'charter'", () => {
    render(<VorTab log={makeLog({ flight_type: "charter" })} />);
    expect(
      screen.getByText(/IFR flight type selected.*30 days/i),
    ).toBeInTheDocument();
  });

  it("hides the IFR hint for non-IFR flight types", () => {
    for (const flight_type of ["advisory", "training", "ferry", "other"] as const) {
      const { unmount } = render(<VorTab log={makeLog({ flight_type })} />);
      expect(
        screen.queryByText(/IFR flight type selected/i),
      ).not.toBeInTheDocument();
      unmount();
    }
  });

  it("prefills inputs from log.vor_* fields", () => {
    render(
      <VorTab
        log={makeLog({
          vor_identifier: "BIG",
          vor_check_type: "ground",
          vor_bearing_indicated: 145,
          vor_bearing_known: 144,
        })}
      />,
    );
    expect(
      (screen.getByLabelText(/VOR Identifier/i) as HTMLInputElement).value,
    ).toBe("BIG");
    expect(
      (screen.getByLabelText(/Bearing Indicated/i) as HTMLInputElement).value,
    ).toBe("145");
  });

  it("computes the signed error live from local bearings", () => {
    render(
      <VorTab
        log={makeLog({
          vor_check_type: "ground",
          vor_bearing_indicated: 145,
          vor_bearing_known: 144,
        })}
      />,
    );
    // Error = 145 - 144 = +1.0
    expect(screen.getByLabelText(/computed error/i)).toHaveTextContent(/\+1\.0/);
    expect(screen.getByLabelText(/computed error/i)).toHaveTextContent(/tol ±4°/);
  });

  it("shows the airborne 6° tolerance when check_type=airborne", () => {
    render(
      <VorTab
        log={makeLog({
          vor_check_type: "airborne",
          vor_bearing_indicated: 145,
          vor_bearing_known: 140,
        })}
      />,
    );
    expect(screen.getByLabelText(/computed error/i)).toHaveTextContent(/tol ±6°/);
    // 5° < 6° tolerance — within limits, not red. We only assert
    // the text + tolerance; styling is implementation detail.
    expect(screen.getByLabelText(/computed error/i)).toHaveTextContent(/\+5\.0/);
  });

  it("disables every input + the cert checkbox in submitted mode", () => {
    render(<VorTab log={makeLog({ status: "submitted" })} />);
    expect(screen.getByLabelText(/VOR Identifier/i)).toBeDisabled();
    expect(screen.getByLabelText(/Check Type/i)).toBeDisabled();
    expect(screen.getByLabelText(/Bearing Indicated/i)).toBeDisabled();
    expect(
      screen.getByLabelText(/I certify this VOR check/i),
    ).toBeDisabled();
  });

  it("shows '—' as the computed error when bearings are missing", () => {
    render(<VorTab log={makeLog()} />);
    expect(screen.getByLabelText(/computed error/i)).toHaveTextContent("—");
  });
});
