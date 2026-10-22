import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ submitIncidentAction: vi.fn() }));
// The form reads its labels from lib/api/safety, whose client would load
// the session through @/auth.
vi.mock("@/lib/api/client", () => ({ ApiError: class ApiError extends Error {} }));
// Next runs the form on React 19; the test runner has React 18, which
// has no useActionState. These tests read the form before any submit.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import type { StationListItem } from "@/lib/api/types";

import { IncidentReportForm } from "./report-form";

/**
 * The time field says which clock it is on and what it is saved as
 * (#72): local to the station, or to the company's base with no station.
 */

const ZONES = {
  byIcao: { PANC: "America/Anchorage", PADK: "America/Adak" },
  fallback: "America/Anchorage",
};

function station(id: string, icao_code: string, name: string): StationListItem {
  return { id, icao_code, name } as StationListItem;
}

const STATIONS = [station("s-anc", "PANC", "Anchorage"), station("s-adk", "PADK", "Adak")];

function renderForm() {
  render(
    <IncidentReportForm stations={STATIONS} zones={ZONES} now="2026-10-21T22:30:00Z" />,
  );
  return screen.getByLabelText(/When did this happen\?/) as HTMLInputElement;
}

describe("IncidentReportForm: the time it happened", () => {
  it("starts on now at the company's base, with the Zulu it is saved as", () => {
    const input = renderForm();
    expect(input.value).toBe("2026-10-21T14:30");
    expect(screen.getByText("When did this happen? (AKDT)")).toBeInTheDocument();
    expect(screen.getByText(/= 22:30Z 2026-10-21/)).toBeInTheDocument();
  });

  it("follows the station's zone when the station is a base with one", async () => {
    const input = renderForm();
    await userEvent.selectOptions(screen.getByLabelText("Station"), "s-adk");
    // The typed time stays; it is now read on Adak's clock.
    expect(input.value).toBe("2026-10-21T14:30");
    expect(screen.getByText("When did this happen? (HADT)")).toBeInTheDocument();
    expect(screen.getByText(/= 23:30Z 2026-10-21/)).toBeInTheDocument();
    const hidden = document.querySelector<HTMLInputElement>('input[name="station_icao"]');
    expect(hidden?.value).toBe("PADK");
  });

  it("shows the Zulu for a time as it is typed", () => {
    const input = renderForm();
    fireEvent.change(input, { target: { value: "2026-10-21T18:45" } });
    expect(screen.getByText(/= 02:45Z 2026-10-22/)).toBeInTheDocument();
  });
});
