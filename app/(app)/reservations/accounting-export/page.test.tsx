import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountingExportResponse } from "@/lib/api/types";

const { TestApiError, getAccountingExport } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getAccountingExport: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getAccountingExport }));

import AccountingExportPage from "./page";

function emptyResponse(): AccountingExportResponse {
  return {
    start: "2026-06-24",
    end: "2026-07-24",
    rows: [],
    totals: { flights: 0, revenue_pax: 0, cargo_lbs: 0, mail_lbs: 0 },
  };
}

beforeEach(() => {
  getAccountingExport.mockReset();
});

async function renderPage(params: Record<string, string> = {}) {
  const page = await AccountingExportPage({
    searchParams: Promise.resolve(params),
  });
  render(page);
}

function exportRow(
  overrides: Partial<AccountingExportResponse["rows"][number]> = {},
): AccountingExportResponse["rows"][number] {
  return {
    id: "f-1",
    date: "2026-09-15",
    flight_number: "EX902",
    flight_type: "scheduled",
    origin: "PANC",
    destination: "PABE",
    aircraft_tail: "N208EX",
    pic_name: "Pat Pilot",
    customer: null,
    revenue_pax: 5,
    cargo_lbs: 250,
    mail_lbs: null,
    notes: null,
    ...overrides,
  };
}

const fromInput = () => screen.getByLabelText("From") as HTMLInputElement;
const toInput = () => screen.getByLabelText("To") as HTMLInputElement;

describe("/reservations/accounting-export", () => {
  it("renders legacy header + subtitle; Export CSV is hidden with 0 rows", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Accounting Export" }),
    ).toBeDefined();
    expect(screen.getByText(/Review completed flight activity/)).toBeDefined();
    // Legacy /acct-export hides the Export CSV button entirely when
    // there are no rows to export. Ours does the same.
    expect(screen.queryByText(/Export CSV/)).toBeNull();
  });

  it("renders 4 summary tiles + empty-state panel with 0 rows", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());

    await renderPage();

    for (const label of ["Completed Flights", "Revenue Passengers", "Cargo", "Mail (USPS)"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
    expect(
      screen.getByText(/No completed flights in this date range/),
    ).toBeDefined();
    expect(
      screen.getByText(/Adjust the date range or check that flights/),
    ).toBeDefined();
    // Table (and its headers) is hidden on empty — matches legacy.
    expect(screen.queryByRole("columnheader")).toBeNull();
  });

  it("renders backend rows with real per-flight columns + 11-column table", async () => {
    getAccountingExport.mockResolvedValue({
      start: "2026-06-24",
      end: "2026-07-24",
      rows: [
        {
          id: "f-1",
          date: "2026-07-15",
          flight_number: "GRT201",
          flight_type: "scheduled",
          origin: "PANC",
          destination: "PABE",
          aircraft_tail: "N207GE",
          pic_name: "Alice Chen",
          customer: null,
          revenue_pax: 5,
          cargo_lbs: 250,
          mail_lbs: null,
          notes: "smooth ride",
        },
      ],
      totals: { flights: 1, revenue_pax: 5, cargo_lbs: 250, mail_lbs: 0 },
    });

    await renderPage();

    expect(screen.getByText("GRT201")).toBeDefined();
    expect(screen.getByText(/PANC → PABE/)).toBeDefined();
    expect(screen.getByText("N207GE")).toBeDefined();
    expect(screen.getByText("Alice Chen")).toBeDefined();
    expect(screen.getByText("scheduled")).toBeDefined();
    expect(screen.getByText("smooth ride")).toBeDefined();
    // With rows > 0, all 11 legacy column headers render.
    for (const col of [
      "Date",
      "Flight #",
      "Type",
      "Route",
      "Aircraft",
      "PIC",
      "Customer",
      "Rev Pax",
      "Cargo lbs",
      "Mail lbs",
      "Notes",
    ]) {
      expect(screen.getByRole("columnheader", { name: col })).toBeDefined();
    }
    // With rows > 0 the Export CSV link surfaces w/ the total count.
    const link = screen
      .getAllByText(/Export CSV/)
      .map((el) => el.closest("a"))
      .find(Boolean);
    expect(link?.textContent).toMatch(/\(1 rows\)/);
  });

  it("renders the 'About this export' info panel from legacy", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());
    await renderPage();
    expect(
      screen.getByText(/QuickBooks, Xero, Sage, or any system that accepts CSV/),
    ).toBeDefined();
  });

  it("T8: filter bar is From / To / Filter / Reset, with no customer dropdown", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());
    await renderPage();
    expect(screen.getByRole("search")).toBeDefined();
    expect(screen.getByRole("button", { name: "Filter" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Reset" }).getAttribute("href")).toBe(
      "/reservations/accounting-export",
    );
    // Legacy's customer filter comes back once the export carries
    // customers. Until then it would list customers and filter nothing.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("All Customers")).toBeNull();
  });

  it("filter bar is a GET form that puts start and end in the URL", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());
    await renderPage();
    const form = screen.getByRole("search") as HTMLFormElement;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/reservations/accounting-export");
    expect(fromInput().name).toBe("start");
    expect(toInput().name).toBe("end");
  });

  it("shows a friendly error banner on 401", async () => {
    getAccountingExport.mockRejectedValue(
      new TestApiError(401, "/ops/accounting-export", "Unauthorized"),
    );
    await renderPage();
    expect(screen.getByText(/session expired/i)).toBeDefined();
  });

  it("shows no zero tiles when the load fails", async () => {
    getAccountingExport.mockRejectedValue(
      new TestApiError(500, "/ops/accounting-export", "Server error"),
    );
    await renderPage();
    expect(screen.getByRole("alert").textContent).toMatch(
      /Accounting export unavailable/,
    );
    expect(screen.queryByText("Completed Flights")).toBeNull();
    expect(screen.queryByText(/No completed flights/)).toBeNull();
  });
});

describe("/reservations/accounting-export: who may see it", () => {
  it("T4: a 403 shows the access panel and nothing behind it", async () => {
    getAccountingExport.mockRejectedValue(
      new TestApiError(403, "/ops/accounting-export", "Forbidden"),
    );
    await renderPage({ start: "2026-09-01", end: "2026-09-30" });

    expect(screen.getByRole("alert").textContent).toBe(
      "The accounting export is limited to executive admins and the director of operations.",
    );
    expect(screen.getByRole("heading", { name: "Accounting Export" })).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByText("Completed Flights")).toBeNull();
    expect(screen.queryByText(/Export CSV/)).toBeNull();
    expect(screen.queryByText(/About this export/)).toBeNull();
  });
});

describe("/reservations/accounting-export: the date range", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function pinNow(iso: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  }

  it("T6: with no range in the URL, asks for the 1st of this month to today and shows it", async () => {
    pinNow("2026-10-02T15:00:00Z");
    getAccountingExport.mockResolvedValue(emptyResponse());

    await renderPage();

    expect(getAccountingExport).toHaveBeenCalledWith({
      start: "2026-10-01",
      end: "2026-10-02",
    });
    expect(fromInput().value).toBe("2026-10-01");
    expect(toInput().value).toBe("2026-10-02");
  });

  it("counts days in UTC, as the export dates flights", async () => {
    // 23:30Z on 30 Sep is still the 30th in UTC (and mid-afternoon in
    // Alaska): the default range is September's.
    pinNow("2026-09-30T23:30:00Z");
    getAccountingExport.mockResolvedValue(emptyResponse());

    await renderPage();

    expect(getAccountingExport).toHaveBeenCalledWith({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });

  it("on the 1st, the default range is that one day", async () => {
    pinNow("2026-10-01T00:30:00Z");
    getAccountingExport.mockResolvedValue(emptyResponse());

    await renderPage();

    expect(getAccountingExport).toHaveBeenCalledWith({
      start: "2026-10-01",
      end: "2026-10-01",
    });
  });

  it("T5: reads start and end from the URL, asks for exactly that range and shows every row", async () => {
    getAccountingExport.mockResolvedValue({
      start: "2026-09-01",
      end: "2026-09-30",
      rows: [
        exportRow({ id: "f-1", flight_number: "EX901", date: "2026-09-01" }),
        exportRow({ id: "f-2", flight_number: "EX902", date: "2026-09-15" }),
        exportRow({ id: "f-3", flight_number: "EX903", date: "2026-09-30" }),
      ],
      totals: { flights: 3, revenue_pax: 9, cargo_lbs: 350, mail_lbs: 0 },
    });

    await renderPage({ start: "2026-09-01", end: "2026-09-30" });

    expect(getAccountingExport).toHaveBeenCalledWith({
      start: "2026-09-01",
      end: "2026-09-30",
    });
    expect(fromInput().value).toBe("2026-09-01");
    expect(toInput().value).toBe("2026-09-30");
    // Header row plus one per flight.
    expect(screen.getAllByRole("row")).toHaveLength(1 + 3);
  });

  it("ignores a date in the URL that is not a real day, and uses the default", async () => {
    pinNow("2026-10-02T15:00:00Z");
    getAccountingExport.mockResolvedValue(emptyResponse());

    await renderPage({ start: "2026-02-30", end: "yesterday" });

    expect(getAccountingExport).toHaveBeenCalledWith({
      start: "2026-10-01",
      end: "2026-10-02",
    });
  });

  it("From after To: the service's 422 is said plainly, and the filter bar stays", async () => {
    getAccountingExport.mockRejectedValue(
      new TestApiError(422, "/ops/accounting-export", '{"detail":"start_after_end"}'),
    );

    await renderPage({ start: "2026-09-30", end: "2026-09-01" });

    expect(getAccountingExport).toHaveBeenCalledWith({
      start: "2026-09-30",
      end: "2026-09-01",
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "The From date is after the To date.",
    );
    expect(fromInput().value).toBe("2026-09-30");
    expect(toInput().value).toBe("2026-09-01");
    expect(screen.queryByText("Completed Flights")).toBeNull();
  });

  it("From after To for a role the service refuses: the access panel, not the filter bar", async () => {
    // The service checks the role before the range, so it answers 403.
    getAccountingExport.mockRejectedValue(
      new TestApiError(403, "/ops/accounting-export", "Forbidden"),
    );

    await renderPage({ start: "2026-09-30", end: "2026-09-01" });

    expect(screen.getByRole("alert").textContent).toBe(
      "The accounting export is limited to executive admins and the director of operations.",
    );
    expect(screen.queryByRole("search")).toBeNull();
  });
});

describe("/reservations/accounting-export: the CSV download", () => {
  it("T7: the Export CSV link carries a cell that begins '=HYPERLINK(", async () => {
    getAccountingExport.mockResolvedValue({
      start: "2026-09-01",
      end: "2026-09-30",
      rows: [exportRow({ notes: '=HYPERLINK("https://x.example","Pay")' })],
      totals: { flights: 1, revenue_pax: 5, cargo_lbs: 250, mail_lbs: 0 },
    });

    await renderPage({ start: "2026-09-01", end: "2026-09-30" });

    const link = screen.getByText(/Export CSV/).closest("a");
    const href = link?.getAttribute("href") ?? "";
    const prefix = "data:text/csv;charset=utf-8,";
    expect(href.startsWith(prefix)).toBe(true);
    const csv = decodeURIComponent(href.slice(prefix.length));
    expect(csv.split("\n")[1]).toMatch(/,"'=HYPERLINK\(""https:\/\/x\.example"",""Pay""\)"$/);
  });
});
