import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PilotTypeQualifications,
  TypeCheckStanding,
  TypeQualificationCell,
  TypePosition,
} from "@/lib/api/type-qualifications";

const { authorisePositionAction, revokePositionAction, recordCheckRideAction } =
  vi.hoisted(() => ({
    authorisePositionAction: vi.fn(),
    revokePositionAction: vi.fn(),
    recordCheckRideAction: vi.fn(),
  }));

vi.mock("./type-qualification-actions", () => ({
  authorisePositionAction,
  revokePositionAction,
  recordCheckRideAction,
}));

import { TypeQualificationsCard } from "./type-qualifications-card";

const PILOT = "11111111-1111-4111-8111-111111111111";
const COMPETENCY_ITEM = "33333333-3333-4333-8333-333333333333";
const INSTRUMENT_ITEM = "44444444-4444-4444-8444-444444444444";

const CHECKS: Record<string, Record<"competency" | "instrument", TypeCheckStanding>> = {
  caravan: {
    competency: {
      check: "competency",
      status: "upcoming",
      last_on: "2026-01-12",
      base_month_due: "2027-01-01",
      grace_month_end: "2027-02-28",
    },
    instrument: {
      check: "instrument",
      status: "due_this_month",
      last_on: "2026-04-20",
      base_month_due: "2026-10-01",
      grace_month_end: "2026-11-30",
    },
  },
  kingair: {
    competency: {
      check: "competency",
      status: "non_current",
      last_on: "2024-05-01",
      base_month_due: "2025-05-01",
      grace_month_end: "2025-06-30",
    },
    instrument: {
      check: "instrument",
      status: "not_started",
      last_on: null,
      base_month_due: null,
      grace_month_end: null,
    },
  },
};

const HELD: Record<string, { state: TypeQualificationCell["state"]; id: string; on: string }> = {
  "caravan/pic": { state: "current", id: "q-cpic", on: "2026-01-10" },
  "caravan/sic": { state: "current", id: "q-csic", on: "2026-01-10" },
  "kingair/sic": { state: "non_current", id: "q-ksic", on: "2025-03-01" },
};

function cellFor(airframe_type: string, position: TypePosition): TypeQualificationCell {
  const held = HELD[`${airframe_type}/${position}`];
  const checks = CHECKS[airframe_type];
  return {
    airframe_type,
    position,
    state: held?.state ?? "not_authorised",
    qualification_id: held?.id ?? null,
    authorised_on: held?.on ?? null,
    checks:
      position === "pic" ? [checks.competency, checks.instrument] : [checks.competency],
  };
}

const POSITIONS: TypePosition[] = ["pic", "sic", "instructor", "check_airman", "advisory"];

const DATA: PilotTypeQualifications = {
  pilot: {
    pilot: { id: PILOT, full_name: "Ana Pilot", email: "ana@example.test" },
    station: "PANC",
    cells: ["caravan", "kingair"].flatMap((t) => POSITIONS.map((p) => cellFor(t, p))),
  },
  airframe_types: ["caravan", "kingair"],
  positions: POSITIONS,
  check_items: { competency: COMPETENCY_ITEM, instrument: INSTRUMENT_ITEM },
  authorisations: [
    {
      id: "q-old",
      airframe_type: "navajo",
      position: "pic",
      authorised_on: "2023-02-01",
      authorised_by: { id: "u1", full_name: "Cal Chief", email: "cal@example.test" },
      revoked_on: "2025-08-01",
      revoked_by: { id: "u1", full_name: "Cal Chief", email: "cal@example.test" },
      notes: "Type retired",
    },
  ],
  checks: [
    {
      completion_id: "c1",
      airframe_type: "kingair",
      check: "competency",
      completion_date: "2026-09-30",
      result: "fail",
      completed_by: "Dana Check",
      examiner_cert_number: "CA-77",
      notes: null,
    },
  ],
};

const ITEMS = {
  competency: { id: COMPETENCY_ITEM, requiresExaminer: true },
  instrument: { id: INSTRUMENT_ITEM, requiresExaminer: true },
};

function renderCard(over: { canAuthorise?: boolean; canRecordCheck?: boolean } = {}) {
  return render(
    <TypeQualificationsCard
      data={DATA}
      checkItems={ITEMS}
      canAuthorise={over.canAuthorise ?? true}
      canRecordCheck={over.canRecordCheck ?? true}
    />,
  );
}

function rowFor(label: string): HTMLElement {
  const cell = screen.getByText(label, { selector: "td" });
  return cell.closest("tr") as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TypeQualificationsCard", () => {
  it("lays out 135ACM's grid: a row per type, a dated cell per position", () => {
    renderCard({ canAuthorise: false, canRecordCheck: false });
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual([
      "Type",
      "PIC",
      "SIC",
      "Instructor",
      "Check Airman",
      "Advisory Pilot",
      "Competency · 135.293",
      "Instrument · 135.297 (PIC)",
    ]);

    const caravan = rowFor("CARAVAN");
    const pic = within(caravan).getAllByText("2026-01-10")[0];
    expect(pic).toHaveAttribute(
      "title",
      "PIC on CARAVAN: Current — authorised 2026-01-10",
    );
    expect(pic.className).toContain("text-status-green");

    // An authorised position whose check has lapsed reads red.
    const kingair = rowFor("KINGAIR");
    expect(within(kingair).getByText("2025-03-01").className).toContain("text-status-red");
  });

  it("shows each type's two checks with when they fall due", () => {
    renderCard({ canAuthorise: false, canRecordCheck: false });
    const caravan = rowFor("CARAVAN");
    expect(within(caravan).getByText("Last 2026-01-12")).toBeInTheDocument();
    expect(within(caravan).getByText("Due Jan 2027")).toBeInTheDocument();
    expect(within(caravan).getByText("Due Oct 2026")).toBeInTheDocument();

    const kingair = rowFor("KINGAIR");
    expect(within(kingair).getByText("Non-Current")).toBeInTheDocument();
    expect(within(kingair).getByText("Not on file")).toBeInTheDocument();
  });

  it("offers no controls to a reader", () => {
    renderCard({ canAuthorise: false, canRecordCheck: false });
    expect(screen.queryByRole("button", { name: /authorise/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /revoke/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /record/i })).toBeNull();
  });

  it("lets a check airman record a check but not authorise", () => {
    renderCard({ canAuthorise: false, canRecordCheck: true });
    expect(screen.getByRole("button", { name: "Record check ride" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /authorise/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /revoke/i })).toBeNull();
  });

  it("authorises the position a cell was opened from", async () => {
    authorisePositionAction.mockResolvedValue({ ok: true });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Authorise Instructor on CARAVAN" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Aircraft type")).toHaveValue("caravan");
    expect(within(dialog).getByLabelText("Position")).toHaveValue("instructor");
    fireEvent.change(within(dialog).getByLabelText("Date authorised"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Authorise" }));

    await waitFor(() =>
      expect(authorisePositionAction).toHaveBeenCalledWith(PILOT, {
        airframe_type: "caravan",
        position: "instructor",
        authorised_on: "2026-10-01",
        notes: "",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("revokes by the authorisation behind the cell, and shows a refusal", async () => {
    revokePositionAction.mockResolvedValue({
      ok: false,
      error: "The revoked date is before the date the position was authorised.",
    });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Revoke SIC on KINGAIR" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("SIC on KINGAIR, authorised 2025-03-01");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Moved to the Caravan" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(revokePositionAction).toHaveBeenCalledWith(PILOT, "q-ksic", {
        revoked_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        notes: "Moved to the Caravan",
      }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The revoked date is before the date the position was authorised.",
    );
  });

  it("records a check ride on the type and check it was opened from", async () => {
    recordCheckRideAction.mockResolvedValue({ ok: true });
    renderCard();
    fireEvent.click(
      screen.getByRole("button", { name: "Record Instrument check (135.297) on KINGAIR" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Aircraft type")).toHaveValue("kingair");
    expect(within(dialog).getByLabelText("Check")).toHaveValue("instrument");
    fireEvent.change(within(dialog).getByLabelText("Date"), {
      target: { value: "2026-10-03" },
    });
    fireEvent.change(within(dialog).getByLabelText("Result"), { target: { value: "pass" } });
    fireEvent.change(within(dialog).getByLabelText("Examiner"), {
      target: { value: "Dana Check" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Examiner certificate/), {
      target: { value: "CA-77" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record" }));

    await waitFor(() =>
      expect(recordCheckRideAction).toHaveBeenCalledWith(PILOT, {
        currency_item_id: INSTRUMENT_ITEM,
        airframe_type: "kingair",
        completion_date: "2026-10-03",
        result: "pass",
        completed_by: "Dana Check",
        examiner_cert_number: "CA-77",
        notes: "",
      }),
    );
  });

  it("will not record a check the company has no item for", async () => {
    render(
      <TypeQualificationsCard
        data={DATA}
        checkItems={{ ...ITEMS, instrument: null }}
        canAuthorise={false}
        canRecordCheck
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Record Instrument check (135.297) on CARAVAN" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "The company has no active Instrument check (135.297) item",
    );
    expect(within(dialog).getByRole("button", { name: "Record" })).toBeDisabled();
  });

  it("keeps revoked positions and failed checks in the history", () => {
    renderCard({ canAuthorise: false, canRecordCheck: false });
    const history = screen.getByText(/^History/).closest("details") as HTMLElement;
    expect(history).toHaveTextContent("1 authorisation, 1 check ride");
    expect(history).toHaveTextContent(
      "PIC · NAVAJO authorised 2023-02-01 by Cal Chief — revoked 2025-08-01 by Cal Chief — Type retired",
    );
    expect(history).toHaveTextContent("KINGAIR · Competency check (135.293) Fail — Dana Check (cert CA-77)");
  });

  it("says where types come from when the fleet has none", () => {
    render(
      <TypeQualificationsCard
        data={{ ...DATA, airframe_types: [], pilot: { ...DATA.pilot, cells: [] } }}
        checkItems={ITEMS}
        canAuthorise
        canRecordCheck
      />,
    );
    expect(screen.getByText(/No aircraft types in the fleet yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Authorise" })).toBeNull();
  });
});
