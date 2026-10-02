import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightLogResponse } from "@/lib/api/types";

const { auth, getFlightLog, tab } = vi.hoisted(() => ({
  auth: vi.fn(),
  getFlightLog: vi.fn(),
  // The tabs and buttons are tested on their own; here they report what
  // the page handed them.
  tab:
    (name: string) =>
    ({ canEdit }: { canEdit?: boolean }) => (
      <div data-testid={name} data-can-edit={String(canEdit)} />
    ),
}));
vi.mock("@/auth", () => ({ auth }));
const { TestApiError } = vi.hoisted(() => ({
  TestApiError: class extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({
  getFlightLog,
  listFlightLogLegs: vi.fn(async () => ({ items: [], total: 0 })),
}));
const { notFound } = vi.hoisted(() => ({ notFound: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound }));

vi.mock("./flight-info-tab", () => ({ FlightInfoTab: tab("info") }));
vi.mock("./legs-tab", () => ({ LegsTab: tab("legs") }));
vi.mock("./wb-tab", () => ({ WeightBalanceTab: tab("wb") }));
vi.mock("./summary-tab", () => ({ SummaryTab: tab("times") }));
vi.mock("./trends-tab", () => ({ TrendsTab: tab("trends") }));
vi.mock("./vor-tab", () => ({ VorTab: tab("vor") }));
vi.mock("./misc-tab", () => ({ MiscTab: tab("misc") }));
vi.mock("./tab-nav", () => ({ TabNav: () => null }));
vi.mock("./audit-timeline-panel", () => ({ AuditTimelinePanel: () => null }));
vi.mock("./lifecycle-buttons", () => ({
  LifecycleButtons: () => <button type="button">Delete</button>,
}));
vi.mock("./submit-log-button", () => ({
  SubmitLogButton: () => <button type="button">Submit Log</button>,
}));

import FlightLogDetailPage from "./page";

const FILER = "u-filer";

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
    created_by: { id: FILER, full_name: "Pat Pilot", email: "p@x.test" },
    created_at: "2026-06-15T12:00:00Z",
    ...over,
  } as FlightLogResponse;
}

async function renderAs(userId: string, roles: string[], tab = "legs", log = makeLog()) {
  auth.mockResolvedValue({ user: { id: userId }, roles });
  getFlightLog.mockResolvedValue(log);
  const ui = await FlightLogDetailPage({
    params: Promise.resolve({ id: log.id }),
    searchParams: Promise.resolve({ tab }),
  });
  return render(ui);
}

const NOTE = /only they, a chief pilot, the director of operations or an exec admin can change it/i;

beforeEach(() => {
  auth.mockReset();
  getFlightLog.mockReset();
});

describe("FlightLogDetailPage: whose draft it is (29 Sep)", () => {
  it("gives the filing pilot the whole draft", async () => {
    await renderAs(FILER, ["pilot"]);
    expect(screen.getByTestId("legs")).toHaveAttribute("data-can-edit", "true");
    expect(screen.getByRole("button", { name: "Submit Log" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it("shows another pilot the draft read-only, and says whose it is", async () => {
    await renderAs("u-other", ["pilot"]);
    expect(screen.getByTestId("legs")).toHaveAttribute("data-can-edit", "false");
    expect(screen.queryByRole("button", { name: "Submit Log" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.getByText(/this is pat pilot.s draft/i)).toBeInTheDocument();
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });

  it.each(["chief_pilot", "director_of_operations", "exec_admin"])(
    "lets a %s correct it, but leaves reopen and delete to the filer",
    async (role) => {
      await renderAs("u-admin", [role]);
      expect(screen.getByTestId("legs")).toHaveAttribute("data-can-edit", "true");
      expect(screen.getByRole("button", { name: "Submit Log" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
      expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    },
  );

  it.each(["info", "legs", "wb", "times", "trends", "vor", "misc"])(
    "hands the %s tab the same answer",
    async (tabKey) => {
      await renderAs("u-other", ["pilot"], tabKey);
      expect(screen.getByTestId(tabKey)).toHaveAttribute("data-can-edit", "false");
    },
  );

  it("says nothing about a submitted log", async () => {
    await renderAs("u-other", ["pilot"], "legs", makeLog({ status: "submitted" }));
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});

describe("FlightLogDetailPage: someone else's log (30 Sep)", () => {
  it("says who may open it when the backend refuses", async () => {
    auth.mockResolvedValue({ user: { id: "u-other" }, roles: ["pilot"] });
    getFlightLog.mockRejectedValue(
      new TestApiError(403, "/ops/flight-logs/log-1", '{"detail":"flight_log_owner_or_admin_only"}'),
    );
    const ui = await FlightLogDetailPage({
      params: Promise.resolve({ id: "log-1" }),
      searchParams: Promise.resolve({}),
    });
    render(ui);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /only the pilot who filed it, a chief pilot, the director of\s+operations or an exec admin can/i,
    );
    expect(screen.getByRole("link", { name: /flight log/i })).toHaveAttribute("href", "/flight-crew/elog");
    expect(screen.queryByTestId("legs")).not.toBeInTheDocument();
  });

  it("still sends a missing log to not-found", async () => {
    auth.mockResolvedValue({ user: { id: "u-other" }, roles: ["pilot"] });
    getFlightLog.mockRejectedValue(new TestApiError(404, "/ops/flight-logs/log-1", "{}"));
    notFound.mockClear();
    await expect(
      FlightLogDetailPage({ params: Promise.resolve({ id: "log-1" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow();
    expect(notFound).toHaveBeenCalled();
  });
});

