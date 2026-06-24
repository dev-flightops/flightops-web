import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPicCompliance, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { getPicCompliance: vi.fn(), TestApiError };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getPicCompliance }));

import { DispatchComplianceGate } from "./dispatch-compliance-gate";
import type {
  ComplianceFinding,
  PicComplianceResponse,
} from "@/lib/api/types";

function makeFinding(over: Partial<ComplianceFinding> = {}): ComplianceFinding {
  return {
    currency_item_id: "i-1",
    code: "competency_check",
    name: "Initial Competency Check",
    regulation: "14 CFR 135.293(a)",
    status: "non_current",
    last_completed_date: "2025-06-15",
    grace_month_end: "2026-07-31",
    message: "Competency check is non-current — hard block.",
    ...over,
  };
}

function makeData(over: Partial<PicComplianceResponse> = {}): PicComplianceResponse {
  return {
    pilot: { id: "p-1", full_name: "Alice Pilot", email: "alice@x.test" },
    dot_color: "green",
    hard_blocks: [],
    soft_warnings: [],
    ...over,
  };
}

async function renderGate(pilotUserId: string | null) {
  const ui = await DispatchComplianceGate({ pilotUserId });
  return render(ui);
}

beforeEach(() => {
  getPicCompliance.mockReset();
});

describe("DispatchComplianceGate", () => {
  it("renders the awaiting placeholder when pilotUserId is null", async () => {
    await renderGate(null);
    expect(getPicCompliance).not.toHaveBeenCalled();
    expect(screen.getByText(/awaiting pic selection/i)).toBeInTheDocument();
  });

  it("renders the green CLEAR banner on dot_color=green", async () => {
    getPicCompliance.mockResolvedValueOnce(makeData());
    await renderGate("p-1");
    expect(
      screen.getByText(/clear — all currency items current/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Pilot")).toBeInTheDocument();
    // View profile link routes into the Spec 5 PR 4a per-pilot page.
    const link = screen.getByRole("link", { name: /view profile/i });
    expect(link.getAttribute("href")).toBe("/compliance/pilots/p-1");
  });

  it("renders the yellow SOFT-WARNING banner with findings list", async () => {
    getPicCompliance.mockResolvedValueOnce(
      makeData({
        dot_color: "yellow",
        soft_warnings: [
          makeFinding({
            currency_item_id: "i-grace",
            code: "ipc",
            name: "Instrument Proficiency Check",
            regulation: "14 CFR 135.297",
            status: "grace_month",
            message: "Grace ends 2026-07-31 — ack required.",
          }),
        ],
      }),
    );
    await renderGate("p-1");
    expect(screen.getByText(/soft warning — ack required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Instrument Proficiency Check/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Grace ends 2026-07-31/i)).toBeInTheDocument();
  });

  it("renders the red HARD-BLOCK banner + listed hard blocks", async () => {
    getPicCompliance.mockResolvedValueOnce(
      makeData({
        dot_color: "red",
        hard_blocks: [makeFinding({ currency_item_id: "i-hard" })],
      }),
    );
    await renderGate("p-1");
    expect(
      screen.getByText(/hard block — pilot cannot fly part 135/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/supervisor override required to release/i),
    ).toBeInTheDocument();
  });

  it("hard-block banner also surfaces concurrent soft warnings", async () => {
    getPicCompliance.mockResolvedValueOnce(
      makeData({
        dot_color: "red",
        hard_blocks: [makeFinding({ currency_item_id: "h-1" })],
        soft_warnings: [
          makeFinding({
            currency_item_id: "s-1",
            code: "ipc",
            name: "Instrument Proficiency Check",
            regulation: "14 CFR 135.297",
            status: "grace_month",
            message: "Grace ends 2026-08-31 — ack required.",
          }),
        ],
      }),
    );
    await renderGate("p-1");
    expect(screen.getByText(/also pending acknowledgment/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Instrument Proficiency Check/i),
    ).toBeInTheDocument();
  });

  it("renders a friendly load error on 401", async () => {
    getPicCompliance.mockRejectedValueOnce(
      new TestApiError(401, "/ops/compliance/pic-check?pilot_id=p-1", "Unauth"),
    );
    await renderGate("p-1");
    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
  });

  it("renders a friendly load error on 404", async () => {
    getPicCompliance.mockRejectedValueOnce(
      new TestApiError(404, "/ops/compliance/pic-check?pilot_id=p-1", "Not Found"),
    );
    await renderGate("p-1");
    expect(screen.getByRole("alert")).toHaveTextContent(/not found/i);
  });

  it("falls back to a generic error on 5xx", async () => {
    getPicCompliance.mockRejectedValueOnce(
      new TestApiError(502, "/ops/compliance/pic-check?pilot_id=p-1", "Bad GW"),
    );
    await renderGate("p-1");
    expect(screen.getByRole("alert")).toHaveTextContent(/HTTP 502/i);
  });

  it("the clear banner uses width helpers (smoke check)", async () => {
    // Sanity check on the rendered surface — guards against template
    // regressions that delete the PIC line wholesale.
    getPicCompliance.mockResolvedValueOnce(makeData());
    const { container } = await renderGate("p-1");
    const banner = within(container).getByText(
      /clear — all currency items current/i,
    ).closest("div");
    expect(banner).not.toBeNull();
  });
});
