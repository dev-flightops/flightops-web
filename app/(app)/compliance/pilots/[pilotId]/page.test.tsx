import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getPilotComplianceProfile,
  getAirmanRecord,
  listDisqualifications,
  notFound,
  TestApiError,
} = vi.hoisted(() => {
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
    getPilotComplianceProfile: vi.fn(),
    getAirmanRecord: vi.fn(),
    listDisqualifications: vi.fn(),
    notFound: vi.fn(() => {
      const err = new Error("NEXT_NOT_FOUND");
      throw err;
    }),
    TestApiError,
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({
  getPilotComplianceProfile,
  getAirmanRecord,
  listDisqualifications,
}));
vi.mock("next/navigation", () => ({ notFound }));
const { getPilotTypeQualifications } = vi.hoisted(() => ({
  getPilotTypeQualifications: vi.fn(),
}));
vi.mock("@/lib/api/type-qualifications", () => ({ getPilotTypeQualifications }));
// Logging a completion is a sign-off (CURRENCY_SIGNOFF, 29 Sep); the
// page asks who is looking. A chief pilot unless a test says otherwise.
const { auth } = vi.hoisted(() => ({
  auth: vi.fn(async () => ({ roles: ["chief_pilot"] as string[] })),
}));
vi.mock("@/auth", () => ({ auth }));

import PilotComplianceProfilePage from "./page";
import type {
  CurrencyItemRef,
  PilotCurrencyCell,
  PilotProfileResponse,
} from "@/lib/api/types";

function makeItem(
  over: Partial<CurrencyItemRef> & { id: string },
): CurrencyItemRef {
  return {
    code: "competency_check",
    name: "Initial Competency Check",
    regulation: "14 CFR 135.293(a)",
    interval_type: "annual",
    requires_examiner: true,
    is_check_event: true,
    is_initial_only: false,
    rolling_days: null,
    rolling_threshold: null,
    sort_order: 10,
    is_default: true,
    is_active: true,
    ...over,
  };
}

function makeCell(
  over: Partial<PilotCurrencyCell> & { currency_item_id: string },
): PilotCurrencyCell {
  return {
    status: "not_started",
    last_completed_date: null,
    base_month_due: null,
    grace_month_end: null,
    rolling_count: null,
    ...over,
  };
}

function makeProfile(
  over: Partial<PilotProfileResponse> = {},
): PilotProfileResponse {
  return {
    pilot: { id: "p-1", full_name: "Alice Pilot", email: "alice@x.test" },
    overall_status: "due_this_month",
    cells: [],
    items: [],
    ...over,
  };
}

async function renderPage(pilotId = "p-1") {
  const ui = await PilotComplianceProfilePage({
    params: Promise.resolve({ pilotId }),
  });
  return render(ui);
}

beforeEach(() => {
  getPilotComplianceProfile.mockReset();
  getAirmanRecord.mockReset();
  listDisqualifications.mockReset();
  // The airman record is a secondary section on this page; these
  // defaults keep the currency assertions below about currency.
  getAirmanRecord.mockResolvedValue({
    pilot: { id: "p-1", full_name: "Alice Chen", email: "a@x.test" },
    certificate_type: null,
    certificate_number: null,
    ratings: [],
    medical_class: null,
    total_time_hours: null,
    pic_time_hours: null,
    cross_country_hours: null,
    night_hours: null,
    instrument_hours: null,
    experience_as_of: null,
    notes: null,
  });
  listDisqualifications.mockResolvedValue({ items: [], open_count: 0 });
  // No aircraft qualifications unless a test says otherwise.
  getPilotTypeQualifications.mockReset();
  getPilotTypeQualifications.mockRejectedValue(new Error("not under test"));
  auth.mockResolvedValue({ roles: ["chief_pilot"] });
  notFound.mockClear();
});

describe("PilotComplianceProfilePage", () => {
  it("renders pilot name + overall status + back link", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(
      makeProfile({ overall_status: "grace_month" }),
    );

    await renderPage();

    expect(screen.getByText("Alice Pilot")).toBeInTheDocument();
    expect(screen.getByText(/back to compliance board/i)).toBeInTheDocument();
    // Overall-status badge present in header.
    expect(screen.getAllByText(/grace/i).length).toBeGreaterThan(0);
  });

  it("renders one card per currency item", async () => {
    const competency = makeItem({ id: "i-1" });
    const ipc = makeItem({
      id: "i-2",
      code: "ipc",
      name: "Instrument Proficiency Check",
      regulation: "14 CFR 135.297",
      interval_type: "semi_annual",
    });
    getPilotComplianceProfile.mockResolvedValueOnce(
      makeProfile({
        items: [competency, ipc],
        cells: [
          makeCell({ currency_item_id: "i-1", status: "due_this_month" }),
          makeCell({ currency_item_id: "i-2", status: "early_month" }),
        ],
      }),
    );

    await renderPage();

    expect(screen.getByText("Initial Competency Check")).toBeInTheDocument();
    expect(
      screen.getByText("Instrument Proficiency Check"),
    ).toBeInTheDocument();
  });

  it("rolling-days item shows the 'updates from flight logs' note + no Log Completion button", async () => {
    const ifr = makeItem({
      id: "i-rolling",
      code: "ifr_currency",
      name: "IFR Currency",
      regulation: "14 CFR 61.57(c)",
      interval_type: "rolling_days",
      is_check_event: false,
      requires_examiner: false,
      rolling_days: 180,
      rolling_threshold: 6,
    });
    getPilotComplianceProfile.mockResolvedValueOnce(
      makeProfile({
        items: [ifr],
        cells: [
          makeCell({
            currency_item_id: "i-rolling",
            status: "not_started",
            rolling_count: 2,
          }),
        ],
      }),
    );

    await renderPage();

    expect(
      screen.getByText(/recompute automatically from submitted flight logs/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /log completion/i }),
    ).not.toBeInTheDocument();
  });

  it("calendar-month items get a Log Completion trigger button", async () => {
    const competency = makeItem({ id: "i-1" });
    getPilotComplianceProfile.mockResolvedValueOnce(
      makeProfile({
        items: [competency],
        cells: [
          makeCell({ currency_item_id: "i-1", status: "due_this_month" }),
        ],
      }),
    );

    await renderPage();

    expect(
      screen.getByRole("button", { name: /log completion/i }),
    ).toBeInTheDocument();
  });

  it("offers a pilot no Log Completion: it is a sign-off, not a self-report", async () => {
    auth.mockResolvedValueOnce({ roles: ["pilot"] });
    const competency = makeItem({ id: "i-1" });
    getPilotComplianceProfile.mockResolvedValueOnce(
      makeProfile({
        items: [competency],
        cells: [makeCell({ currency_item_id: "i-1", status: "due_this_month" })],
      }),
    );

    await renderPage();

    expect(screen.queryByRole("button", { name: /log completion/i })).toBeNull();
  });

  it("calls notFound() on a 404 from the API", async () => {
    getPilotComplianceProfile.mockRejectedValueOnce(
      new TestApiError(404, "/ops/compliance/pilots/p-1/profile", "Not Found"),
    );

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the session-expired message on 401", async () => {
    getPilotComplianceProfile.mockRejectedValueOnce(
      new TestApiError(401, "/ops/compliance/pilots/p-1/profile", "Unauth"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });

  it("compliance percent ignores not_started cells from compliant bucket", async () => {
    // 2 due_this_month + 1 non_current + 1 not_started → 2/4 = 50%.
    const items = ["i-1", "i-2", "i-3", "i-4"].map((id) =>
      makeItem({ id, code: id, name: `Item ${id}` }),
    );
    getPilotComplianceProfile.mockResolvedValueOnce(
      makeProfile({
        items,
        cells: [
          makeCell({ currency_item_id: "i-1", status: "due_this_month" }),
          makeCell({ currency_item_id: "i-2", status: "grace_month" }),
          makeCell({ currency_item_id: "i-3", status: "non_current" }),
          makeCell({ currency_item_id: "i-4", status: "not_started" }),
        ],
      }),
    );

    await renderPage();

    // 2 of 4 cells are non_current/not_started → 2/4 = 50% legally current.
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});

describe("the airman record section", () => {
  it("renders alongside the currency cards", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(makeProfile());
    getAirmanRecord.mockResolvedValueOnce({
      pilot: { id: "p-1", full_name: "Alice Pilot", email: "a@x.test" },
      certificate_type: "airline_transport",
      certificate_number: "1234567",
      ratings: ["amel"],
      medical_class: "first",
      total_time_hours: "5210.4",
      pic_time_hours: null,
      cross_country_hours: null,
      night_hours: null,
      instrument_hours: null,
      experience_as_of: "2026-08-01",
      notes: null,
    });

    await renderPage();

    expect(screen.getByText(/14 CFR 135\.63/)).toBeInTheDocument();
    expect(screen.getByText("Airline Transport")).toBeInTheDocument();
    expect(screen.getByText("5210.4")).toBeInTheDocument();
  });

  it("still renders currency when the airman record cannot be loaded", async () => {
    // The reason both calls are soft-failed. Currency is what this page
    // is primarily for, and losing the secondary section should cost the
    // reader that section rather than the whole page.
    getPilotComplianceProfile.mockResolvedValueOnce(makeProfile());
    getAirmanRecord.mockRejectedValueOnce(
      new TestApiError(500, "/airman-record", "nope"),
    );
    listDisqualifications.mockRejectedValueOnce(
      new TestApiError(500, "/disqualifications", "nope"),
    );

    await renderPage();

    expect(screen.getByText("Alice Pilot")).toBeInTheDocument();
    expect(screen.getByText(/back to compliance board/i)).toBeInTheDocument();
    expect(screen.queryByText(/14 CFR 135\.63/)).not.toBeInTheDocument();
  });

  it("withholds the section when only the disqualification call fails", async () => {
    // Half a compliance record is worse than none: a reader who sees the
    // certificate block and no disqualification list would reasonably
    // conclude there are none.
    getPilotComplianceProfile.mockResolvedValueOnce(makeProfile());
    listDisqualifications.mockRejectedValueOnce(
      new TestApiError(500, "/disqualifications", "nope"),
    );

    await renderPage();

    expect(screen.queryByText(/14 CFR 135\.63/)).not.toBeInTheDocument();
    expect(screen.getByText("Alice Pilot")).toBeInTheDocument();
  });
});

describe("the aircraft qualifications section", () => {
  const typeQuals = {
    pilot: {
      pilot: { id: "p-1", full_name: "Alice Pilot", email: "alice@x.test" },
      station: "PANC",
      cells: [],
    },
    airframe_types: ["caravan"],
    positions: ["pic", "sic", "instructor", "check_airman", "advisory"],
    check_items: { competency: "i-1", instrument: null },
    authorisations: [],
    checks: [],
  };

  it("gives a chief pilot the grid with authorise and check ride controls", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(
      makeProfile({ items: [makeItem({ id: "i-1" })] }),
    );
    getPilotTypeQualifications.mockResolvedValueOnce(typeQuals);

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /aircraft qualifications/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Authorise" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record check ride" })).toBeInTheDocument();
  });

  it("lets a check airman record a check ride but not authorise", async () => {
    auth.mockResolvedValue({ roles: ["check_airman"] });
    getPilotComplianceProfile.mockResolvedValueOnce(makeProfile());
    getPilotTypeQualifications.mockResolvedValueOnce(typeQuals);

    await renderPage();

    expect(screen.getByRole("button", { name: "Record check ride" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Authorise" })).toBeNull();
  });

  it("shows a pilot their grid without controls", async () => {
    auth.mockResolvedValue({ roles: ["pilot"] });
    getPilotComplianceProfile.mockResolvedValueOnce(makeProfile());
    getPilotTypeQualifications.mockResolvedValueOnce(typeQuals);

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /aircraft qualifications/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record check ride" })).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Authorise" })).toBeNull();
  });

  it("still renders currency when the qualifications cannot be loaded", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(
      makeProfile({
        items: [makeItem({ id: "i-1" })],
        cells: [makeCell({ currency_item_id: "i-1", status: "due_this_month" })],
      }),
    );

    await renderPage();

    expect(screen.getByText("Initial Competency Check")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /aircraft qualifications/i }),
    ).toBeNull();
  });
});
