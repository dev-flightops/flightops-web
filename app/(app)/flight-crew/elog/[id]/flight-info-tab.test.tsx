import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FlightLogResponse } from "@/lib/api/types";

vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "u-1" }, roles: ["pilot"] })) }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/ops", () => ({ getComplianceBoard: vi.fn(async () => ({ rows: [] })) }));
vi.mock("./sic-picker", () => ({
  SicPicker: ({ readOnly }: { readOnly: boolean }) => (
    <div data-testid="sic-picker" data-readonly={String(readOnly)} />
  ),
}));

import { FlightInfoTab } from "./flight-info-tab";

function makeLog(over: Partial<FlightLogResponse> = {}): FlightLogResponse {
  return {
    id: "log-1",
    log_number: "LOG-20260615-150000",
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "C208", seats: 9, airframe_type: "caravan" },
    flight_id: null,
    flight_number: null,
    flight_type: "advisory",
    flight_date: "2026-06-15",
    status: "draft",
    is_manual_entry: false,
    created_by: { id: "u-1", full_name: "Pat Pilot", email: "p@x.test" },
    created_at: "2026-06-15T12:00:00Z",
    ...over,
  } as FlightLogResponse;
}

describe("FlightInfoTab: who picks the SIC (29 Sep)", () => {
  it("lets the draft's editor pick", async () => {
    render(await FlightInfoTab({ log: makeLog() }));
    expect(screen.getByTestId("sic-picker")).toHaveAttribute("data-readonly", "false");
  });

  it("is read-only when the caller may not change the draft", async () => {
    render(await FlightInfoTab({ log: makeLog(), canEdit: false }));
    expect(screen.getByTestId("sic-picker")).toHaveAttribute("data-readonly", "true");
  });
});
