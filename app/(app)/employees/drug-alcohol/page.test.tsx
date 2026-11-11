import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DrugAlcoholAccess, Overview, TestRecord } from "@/lib/api/drug-alcohol";

const { TestApiError, auth, api, settingsApi } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    auth: vi.fn(async () => ({ roles: ["chief_pilot"] as string[] })),
    api: { getDrugAlcoholAccess: vi.fn(), getOverview: vi.fn(), getClearance: vi.fn() },
    settingsApi: { getComplianceSettings: vi.fn(async () => ({ drug_alcohol_blocks: false })) },
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/drug-alcohol", () => api);
vi.mock("@/lib/api/type-qualifications", () => settingsApi);
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: async () => ({ byIcao: {}, fallback: "America/Anchorage" }) }));
vi.mock("@/auth", () => ({ auth }));
// The switch is a client component tested on its own; here only its place.
vi.mock("./release-card", () => ({ ReleaseCard: () => <div>release switch</div> }));

import DrugAlcoholPage from "./page";

const DER = { id: "der-1", full_name: "Dee Rep", email: "der@test.local" };

function access(over: Partial<DrugAlcoholAccess> = {}): DrugAlcoholAccess {
  return {
    runs_program: false,
    sees_clearance: false,
    program_open: true,
    der: DER,
    alternate_der: null,
    der_phone: "907-555-0100",
    release_blocks: false,
    ...over,
  };
}

function testRecord(over: Partial<TestRecord> = {}): TestRecord {
  return {
    id: "t-1",
    user_id: "u-1",
    full_name: "Nina Hale",
    test_type: "random",
    test_type_label: "Random",
    panel: "drug",
    test_date: "2026-11-02",
    collected_at: null,
    category: "flight_crewmember",
    category_label: "Flight Crewmember",
    result: "positive",
    result_label: "Positive",
    violation: true,
    drugs: ["marijuana"],
    refusal_reason: null,
    screening_level: null,
    confirmation_level: null,
    collection_site: null,
    mro: { id: "m-1", kind: "mro", name: "Dr. Review" },
    lab: null,
    specimen_id: "0012345",
    split_requested: false,
    selection_entry_id: null,
    notes: null,
    returned_to_duty_at: null,
    returned_to_duty_by: null,
    hold_ends_at: null,
    recorded_by: null,
    created_at: "2026-11-02T20:00:00Z",
    files: [
      {
        id: "f-1",
        kind: "chain_of_custody",
        original_filename: "ccf.pdf",
        content_type: "application/pdf",
        size_bytes: 10,
        created_at: "2026-11-02T20:00:00Z",
      },
    ],
    ...over,
  };
}

function overview(over: Partial<Overview> = {}): Overview {
  return {
    year: 2026,
    program_open: true,
    program: {
      saved: true,
      der: DER,
      alternate_der: null,
      der_phone: null,
      drug_rate_pct: 25,
      alcohol_rate_pct: 10,
      safety_sensitive_roles: ["pilot"],
      faa_certificate_number: null,
      plan_number: null,
      ctpa_name: null,
      ctpa_phone: null,
    },
    pool_size: 12,
    random: [
      { panel: "drug", rate_pct: 25, basis: "average", average_pool: 12, selections: 3, required: 3, done: 2, met: false },
      { panel: "alcohol", rate_pct: 10, basis: "average", average_pool: 12, selections: 3, required: 2, done: 2, met: true },
    ],
    tests_this_year: { drug: 5, alcohol: 2, violations: 1 },
    not_cleared: [
      { user_id: "u-2", full_name: "Pat Pilot", in_pool: true, cleared: false, reasons: ["no_pre_employment"], hold_ends_at: null },
    ],
    open_entries: [],
    pending_results: [],
    recent_tests: [testRecord()],
    recent_selections: [],
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("/employees/drug-alcohol", () => {
  it("shows the DER the year's rates, who isn't cleared and why, and the tests", async () => {
    api.getDrugAlcoholAccess.mockResolvedValueOnce(access({ runs_program: true, sees_clearance: true }));
    api.getOverview.mockResolvedValueOnce(overview());
    render(await DrugAlcoholPage());
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("Random drug · 25%")).toBeInTheDocument();
    const notCleared = screen.getByText("Pat Pilot").closest("li")!;
    expect(within(notCleared).getByText("No negative pre-employment drug test on file")).toBeInTheDocument();
    const row = screen.getByText("Nina Hale").closest("tr")!;
    expect(within(row).getByText("Positive")).toBeInTheDocument();
    expect(within(row).getByText("Found: Marijuana")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /Custody and control form/ })).toHaveAttribute(
      "href",
      "/api/drug-alcohol/files/f-1/download",
    );
    expect(screen.getByRole("link", { name: "Random Pool" })).toHaveAttribute("href", "/employees/drug-alcohol/pool");
  });

  it("asks for a DER when there isn't one", async () => {
    api.getDrugAlcoholAccess.mockResolvedValueOnce(access({ runs_program: true, sees_clearance: true, der: null }));
    api.getOverview.mockResolvedValueOnce(overview({ program: { ...overview().program, der: null } }));
    render(await DrugAlcoholPage());
    expect(screen.getByText(/Name the program’s Designated Employer Representative/)).toBeInTheDocument();
  });

  it("shows a leader who's cleared, yes or no, never why", async () => {
    api.getDrugAlcoholAccess.mockResolvedValueOnce(access({ sees_clearance: true }));
    api.getClearance.mockResolvedValueOnce({
      release_blocks: false,
      program_open: true,
      items: [
        { user_id: "u-1", full_name: "Nina Hale", roles: ["pilot"], in_pool: true, cleared: true },
        { user_id: "u-2", full_name: "Pat Pilot", roles: ["pilot"], in_pool: true, cleared: false },
      ],
    });
    render(await DrugAlcoholPage());
    expect(api.getOverview).not.toHaveBeenCalled();
    expect(within(screen.getByText("Pat Pilot").closest("tr")!).getByText("Not cleared")).toBeInTheDocument();
    expect(within(screen.getByText("Nina Hale").closest("tr")!).getByText("Cleared")).toBeInTheDocument();
    expect(screen.queryByText(/pre-employment/)).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 not cleared.")).toBeInTheDocument();
    expect(screen.getByText("release switch")).toBeInTheDocument();
  });

  it("tells a leader the program isn't set up yet, rather than flag everyone", async () => {
    api.getDrugAlcoholAccess.mockResolvedValueOnce(access({ sees_clearance: true, der: null }));
    api.getClearance.mockResolvedValueOnce({ release_blocks: false, program_open: false, items: [] });
    render(await DrugAlcoholPage());
    expect(screen.getByText(/hasn’t set up its drug and alcohol program here yet/)).toBeInTheDocument();
    expect(screen.queryByText("Not cleared")).not.toBeInTheDocument();
  });

  it("points anyone else at their own tests and the DER", async () => {
    api.getDrugAlcoholAccess.mockResolvedValueOnce(access());
    render(await DrugAlcoholPage());
    expect(api.getClearance).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "My Tests" })).toHaveAttribute("href", "/employees/drug-alcohol/my-tests");
    expect(screen.getByText(/DER: Dee Rep · 907-555-0100/)).toBeInTheDocument();
  });

  it("says so when the program can't be read", async () => {
    api.getDrugAlcoholAccess.mockRejectedValueOnce(new TestApiError(503, "/x", "down"));
    render(await DrugAlcoholPage());
    expect(screen.getByRole("alert")).toHaveTextContent("The drug and alcohol program is unavailable.");
  });
});
