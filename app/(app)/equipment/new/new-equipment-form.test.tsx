import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ createEquipmentAction: vi.fn() }));
// jsdom here has no useActionState; the form's idle state is what's under test.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn(), false],
}));

import { NewEquipmentForm } from "./new-equipment-form";

const UNIT = {
  id: "u-1",
  name: "GPU 2",
  equipment_type: "gpu",
  make: "Hobart",
  model: "60CU24",
  serial_number: null,
  year: 2009,
  station: { id: "s-9", icao_code: "PADU", name: "Unalaska" },
  status: "operational",
  status_note: null,
  last_service_date: null,
  next_service_date: "2026-08-03",
  service_interval_days: 180,
  hours_total: 6447,
  purchase_date: null,
  manufacturer: "Hobart",
  is_active: true,
  notes: null,
  open_squawk_count: 0,
} as const;

describe("NewEquipmentForm as the edit form (#134)", () => {
  it("fills in the unit's values and saves", () => {
    render(<NewEquipmentForm stations={[]} unit={UNIT as never} submit={vi.fn()} />);
    expect(screen.getByLabelText(/^Name/)).toHaveValue("GPU 2");
    expect(screen.getByLabelText(/^Equipment Type/)).toHaveValue("gpu");
    expect(screen.getByLabelText("Next service")).toHaveValue("2026-08-03");
    expect(screen.getByLabelText("Serial #")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("keeps the unit's station selectable when the station list came back without it", () => {
    render(<NewEquipmentForm stations={[]} unit={UNIT as never} submit={vi.fn()} />);
    expect(screen.getByLabelText(/^Assigned Station/)).toHaveValue("s-9");
    expect(screen.getByRole("option", { name: "PADU · Unalaska" })).toBeInTheDocument();
  });

  it("adds a unit when there is none", () => {
    render(<NewEquipmentForm stations={[]} />);
    expect(screen.getByLabelText(/^Name/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add equipment" })).toBeInTheDocument();
  });
});
