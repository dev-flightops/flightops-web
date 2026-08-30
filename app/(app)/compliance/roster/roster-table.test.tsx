import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  CurrencyItemRef,
  FlightTimeWindow,
  PilotRosterGroup,
  PilotRosterRow,
} from "@/lib/api/types";

import { RosterTable } from "./roster-table";

/**
 * The roster is what a chief pilot reads before assigning anyone. The
 * assertions here are mostly about a number being findable on the right
 * row — a flight-time figure attached to the wrong pilot would look
 * entirely plausible and be completely wrong.
 */

const ITEMS: CurrencyItemRef[] = [
  { id: "i-med", code: "medical_certificate", name: "Medical Certificate" },
  { id: "i-ipc", code: "ipc", name: "Instrument Proficiency Check" },
] as unknown as CurrencyItemRef[];

const win = (
  over: Partial<FlightTimeWindow> & { window: FlightTimeWindow["window"] },
): FlightTimeWindow => ({
  label: "24 consecutive hours",
  citation: "14 CFR 135.265(a)(1)",
  hours: "0",
  limit: "8",
  remaining: "8",
  exceeded: false,
  approaching: false,
  ...over,
});

// Real citations per window — the server sends a distinct paragraph for
// each, and a fixture that reuses one hides whether the right citation
// reaches the right column.
const ALL_WINDOWS = [
  win({ window: "h24" }),
  win({
    window: "d7", limit: "30", remaining: "30",
    label: "7 consecutive days", citation: "14 CFR 135.265(b)(1)",
  }),
  win({
    window: "month", limit: "100", remaining: "100",
    label: "calendar month", citation: "14 CFR 135.265(b)(2)",
  }),
  win({
    window: "year", limit: "1000", remaining: "1000",
    label: "calendar year", citation: "14 CFR 135.265(b)(3)",
  }),
];

function row(over: Partial<PilotRosterRow> = {}): PilotRosterRow {
  return {
    pilot: { id: "p-1", full_name: "Alice Pilot", email: "a@x.test" },
    station: "PANC",
    title: "PIC",
    emp_number: "E001",
    overall_status: "upcoming",
    cells: [
      { currency_item_id: "i-med", status: "upcoming" },
      { currency_item_id: "i-ipc", status: "upcoming" },
    ],
    flight_time: ALL_WINDOWS,
    flight_time_exceeded: false,
    ...over,
  } as unknown as PilotRosterRow;
}

const group = (label: string, rows: PilotRosterRow[]): PilotRosterGroup =>
  ({ station: label === "Unassigned" ? null : label, label, rows }) as PilotRosterGroup;

const rowFor = (name: string) =>
  screen.getByRole("row", { name: new RegExp(name) });

describe("layout", () => {
  it("renders a section per base with its headcount", () => {
    render(
      <RosterTable
        items={ITEMS}
        groups={[
          group("PANC", [row()]),
          group("PABE", [
            row({ pilot: { id: "p-2", full_name: "Bob Pilot" } as never }),
            row({ pilot: { id: "p-3", full_name: "Cara Pilot" } as never }),
          ]),
        ]}
      />,
    );
    expect(screen.getByText(/PANC/)).toBeInTheDocument();
    expect(screen.getByText("1 pilot")).toBeInTheDocument();
    expect(screen.getByText("2 pilots")).toBeInTheDocument();
  });

  it("shows the four flight-time columns", () => {
    render(<RosterTable items={ITEMS} groups={[group("PANC", [row()])]} />);
    for (const head of ["24h", "7d", "Mo", "Yr"]) {
      expect(screen.getByRole("columnheader", { name: head })).toBeInTheDocument();
    }
  });

  it("omits certificate and aircraft columns rather than showing empty ones", () => {
    // Neither is stored yet. A column of dashes reads as "we checked and
    // there's nothing", which is not what's true.
    render(<RosterTable items={ITEMS} groups={[group("PANC", [row()])]} />);
    expect(
      screen.queryByRole("columnheader", { name: /cert/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /aircraft/i }),
    ).not.toBeInTheDocument();
  });

  it("says so plainly when there are no pilots", () => {
    render(<RosterTable items={ITEMS} groups={[]} />);
    expect(screen.getByText(/No active pilots/i)).toBeInTheDocument();
  });

  it("puts the flight-time columns ahead of the currency matrix", () => {
    // Legacy had the hours last, after five currency columns. Our matrix
    // is the operator's whole catalogue — seventeen items on the demo
    // tenant — which pushed all four hours columns outside the scroll
    // container at 1440px. The banner would announce a pilot was out of
    // hours while the figures needed sideways scrolling to reach.
    render(<RosterTable items={ITEMS} groups={[group("PANC", [row()])]} />);
    const heads = screen
      .getAllByRole("columnheader")
      .map((th) => th.textContent?.trim());
    expect(heads.slice(0, 6)).toEqual(["Name", "Role", "24h", "7d", "Mo", "Yr"]);
  });

  it("aligns each hours figure under its own heading", () => {
    // Header and body render from two separate loops, so moving one
    // without the other prints currency pills under "24h". Distinct
    // values per window: a misalignment cannot coincide with a pass.
    render(
      <RosterTable
        items={ITEMS}
        groups={[
          group("PANC", [
            row({
              flight_time: [
                win({ window: "h24", hours: "5.00" }),
                win({ window: "d7", hours: "12.00", limit: "30" }),
                win({ window: "month", hours: "40.00", limit: "100" }),
                win({ window: "year", hours: "300.00", limit: "1000" }),
              ],
            }),
          ]),
        ]}
      />,
    );
    const heads = screen
      .getAllByRole("columnheader")
      .map((th) => th.textContent?.trim());
    const cells = within(rowFor("Alice Pilot"))
      .getAllByRole("cell")
      .map((td) => td.textContent?.trim());
    expect(cells[heads.indexOf("24h")]).toBe("5.00");
    expect(cells[heads.indexOf("7d")]).toBe("12.00");
    expect(cells[heads.indexOf("Mo")]).toBe("40.00");
    expect(cells[heads.indexOf("Yr")]).toBe("300.00");
  });

  it("keeps the wide table in its own scroll container", () => {
    // The currency columns grow with the operator's catalogue. Without
    // this the page itself scrolls sideways.
    const { container } = render(
      <RosterTable items={ITEMS} groups={[group("PANC", [row()])]} />,
    );
    expect(container.querySelector(".overflow-x-auto")).not.toBeNull();
  });
});

describe("flight time lands on the right pilot", () => {
  it("shows each pilot's own hours", () => {
    render(
      <RosterTable
        items={ITEMS}
        groups={[
          group("PANC", [
            row({
              pilot: { id: "p-1", full_name: "Alice Pilot" } as never,
              flight_time: [win({ window: "h24", hours: "5.00" }), ...ALL_WINDOWS.slice(1)],
            }),
            row({
              pilot: { id: "p-2", full_name: "Bob Pilot" } as never,
              flight_time: [win({ window: "h24", hours: "1.50" }), ...ALL_WINDOWS.slice(1)],
            }),
          ]),
        ]}
      />,
    );
    expect(within(rowFor("Alice Pilot")).getByText("5.00")).toBeInTheDocument();
    expect(within(rowFor("Bob Pilot")).getByText("1.50")).toBeInTheDocument();
  });

  it("puts the CFR paragraph on the number, not just the hours", () => {
    // "Why is this red" is answered by the citation, not the figure.
    render(
      <RosterTable
        items={ITEMS}
        groups={[
          group("PANC", [
            row({
              flight_time: [
                win({ window: "h24", hours: "8.00", exceeded: true, remaining: "0" }),
                ...ALL_WINDOWS.slice(1),
              ],
            }),
          ]),
        ]}
      />,
    );
    expect(screen.getByTitle(/14 CFR 135\.265\(a\)\(1\)/)).toBeInTheDocument();
    expect(screen.getByTitle(/8\.00 of 8 h/)).toBeInTheDocument();
  });

  it("renders a dash for a window the server did not send", () => {
    render(
      <RosterTable
        items={ITEMS}
        groups={[group("PANC", [row({ flight_time: [win({ window: "h24" })] })])]}
      />,
    );
    // Three of four windows absent — dashes, not blanks or zeroes.
    expect(within(rowFor("Alice Pilot")).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});

describe("an over-limit pilot", () => {
  it("tints the whole row so it reads at a glance", () => {
    render(
      <RosterTable
        items={ITEMS}
        groups={[group("PANC", [row({ flight_time_exceeded: true })])]}
      />,
    );
    expect(rowFor("Alice Pilot").className).toMatch(/bg-status-red/);
  });

  it("leaves a compliant row untinted", () => {
    render(<RosterTable items={ITEMS} groups={[group("PANC", [row()])]} />);
    expect(rowFor("Alice Pilot").className).not.toMatch(/bg-status-red/);
  });

  it("does not colour the row from currency status", () => {
    // A non-current pilot is a currency problem, shown in the currency
    // cells. The row tint means one thing only: out of hours.
    render(
      <RosterTable
        items={ITEMS}
        groups={[
          group("PANC", [
            row({ overall_status: "non_current" as never, flight_time_exceeded: false }),
          ]),
        ]}
      />,
    );
    expect(rowFor("Alice Pilot").className).not.toMatch(/bg-status-red/);
  });
});

describe("identity", () => {
  it("links a pilot to their compliance profile", () => {
    render(<RosterTable items={ITEMS} groups={[group("PANC", [row()])]} />);
    expect(screen.getByRole("link", { name: /Alice Pilot/ })).toHaveAttribute(
      "href",
      "/compliance/pilots/p-1",
    );
  });

  it("shows the employee number when there is one", () => {
    render(<RosterTable items={ITEMS} groups={[group("PANC", [row()])]} />);
    expect(screen.getByText("E001")).toBeInTheDocument();
  });

  it("dashes a missing title rather than leaving the cell blank", () => {
    render(
      <RosterTable items={ITEMS} groups={[group("PANC", [row({ title: null })])]} />,
    );
    expect(within(rowFor("Alice Pilot")).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("still lists a pilot with no base, under Unassigned", () => {
    render(
      <RosterTable
        items={ITEMS}
        groups={[group("Unassigned", [row({ station: null })])]}
      />,
    );
    expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
    expect(rowFor("Alice Pilot")).toBeInTheDocument();
  });
});
