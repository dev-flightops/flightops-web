import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPilotComplianceProfile, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { getPilotComplianceProfile: vi.fn(), TestApiError };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getPilotComplianceProfile }));

import { TrainingCurrencySummary } from "./training-currency-summary";
import type {
  CurrencyItemRef,
  CurrencyStatus,
  PilotCurrencyCell,
  PilotProfileResponse,
} from "@/lib/api/types";

function item(
  over: Partial<CurrencyItemRef> & { id: string; code: string },
): CurrencyItemRef {
  return {
    name: over.code,
    regulation: "14 CFR 135.293",
    interval_type: "annual",
    requires_examiner: false,
    is_check_event: false,
    is_initial_only: false,
    rolling_days: null,
    rolling_threshold: null,
    sort_order: 100,
    is_default: true,
    is_active: true,
    ...over,
  };
}

function cell(
  itemId: string,
  status: CurrencyStatus,
  over: Partial<PilotCurrencyCell> = {},
): PilotCurrencyCell {
  return {
    currency_item_id: itemId,
    status,
    last_completed_date: null,
    base_month_due: null,
    grace_month_end: null,
    rolling_count: null,
    ...over,
  };
}

function profile(
  cells: PilotCurrencyCell[],
  items: CurrencyItemRef[],
): PilotProfileResponse {
  return {
    pilot: { id: "p-1", full_name: "Greg", email: "g@x.test" },
    overall_status: "due_this_month",
    cells,
    items,
  };
}

async function renderCard() {
  const ui = await TrainingCurrencySummary({ pilotUserId: "p-1" });
  return render(ui);
}

beforeEach(() => {
  getPilotComplianceProfile.mockReset();
});

describe("TrainingCurrencySummary", () => {
  it("renders the empty state when the pilot has no tracked items", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(profile([], []));
    await renderCard();
    expect(
      screen.getByText(/no currency items tracked yet/i),
    ).toBeInTheDocument();
  });

  it("renders the 401 message when the profile fetch fails with Unauthorized", async () => {
    getPilotComplianceProfile.mockRejectedValueOnce(
      new TestApiError(401, "/compliance/pilots/p-1/profile", "Unauthorized"),
    );
    await renderCard();
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
  });

  it("renders a row per item with calendar status badge", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(
      profile(
        [
          cell("i-1", "due_this_month"),
          cell("i-2", "early_month"),
        ],
        [
          item({ id: "i-1", code: "ipc", name: "IPC" }),
          item({ id: "i-2", code: "cfit", name: "CFIT Training" }),
        ],
      ),
    );
    await renderCard();
    expect(screen.getByText("IPC")).toBeInTheDocument();
    expect(screen.getByText("CFIT Training")).toBeInTheDocument();
    // Two status badges visible.
    expect(screen.getByText(/due this month/i)).toBeInTheDocument();
    expect(screen.getByText(/early/i)).toBeInTheDocument();
  });

  it("surfaces a red non-current banner naming the items", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(
      profile(
        [
          cell("i-1", "non_current"),
          cell("i-2", "due_this_month"),
        ],
        [
          item({ id: "i-1", code: "med", name: "Medical Certificate" }),
          item({ id: "i-2", code: "ipc", name: "IPC" }),
        ],
      ),
    );
    await renderCard();
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/non-current on medical certificate/i);
    expect(banner).toHaveTextContent(/contact your chief pilot/i);
  });

  it("sorts non-current first, then by urgency", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(
      profile(
        [
          cell("i-1", "upcoming"),
          cell("i-2", "non_current"),
          cell("i-3", "grace_month"),
        ],
        [
          item({ id: "i-1", code: "a", name: "Alpha" }),
          item({ id: "i-2", code: "b", name: "Bravo" }),
          item({ id: "i-3", code: "c", name: "Charlie" }),
        ],
      ),
    );
    await renderCard();
    // The list-item rendering order should be Bravo (non_current),
    // Charlie (grace), Alpha (upcoming).
    const labels = screen.getAllByText(/^(Alpha|Bravo|Charlie)$/);
    expect(labels.map((el) => el.textContent)).toEqual([
      "Bravo",
      "Charlie",
      "Alpha",
    ]);
  });

  it("renders rolling items with N/threshold and met-vs-short tone", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(
      profile(
        [
          cell("i-1", "upcoming", { rolling_count: 4 }),
          cell("i-2", "upcoming", { rolling_count: 1 }),
        ],
        [
          item({
            id: "i-1",
            code: "ifr_currency",
            name: "IFR Currency",
            interval_type: "rolling_days",
            rolling_days: 180,
            rolling_threshold: 6,
          }),
          item({
            id: "i-2",
            code: "day_landing_currency",
            name: "Day Landings",
            interval_type: "rolling_days",
            rolling_days: 90,
            rolling_threshold: 3,
          }),
        ],
      ),
    );
    await renderCard();
    expect(screen.getByText("4/6")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("renders a link to the full pilot profile", async () => {
    getPilotComplianceProfile.mockResolvedValueOnce(
      profile(
        [cell("i-1", "due_this_month")],
        [item({ id: "i-1", code: "ipc" })],
      ),
    );
    await renderCard();
    const link = screen.getByRole("link", { name: /full profile/i });
    expect(link).toHaveAttribute("href", "/compliance/pilots/p-1");
  });
});
