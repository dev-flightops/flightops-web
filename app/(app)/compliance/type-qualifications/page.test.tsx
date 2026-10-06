import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  TypeQualificationCell,
  TypeQualificationGrid,
  TypeQualificationPilot,
  TypePosition,
} from "@/lib/api/type-qualifications";

const { getTypeQualificationGrid, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  }
  return { getTypeQualificationGrid: vi.fn(), TestApiError };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/type-qualifications", () => ({ getTypeQualificationGrid }));

import TypeQualificationsPage from "./page";

const POSITIONS: TypePosition[] = ["pic", "sic", "instructor", "check_airman", "advisory"];
const TYPES = ["caravan", "kingair"];

function pilot(
  id: string,
  full_name: string,
  station: string | null,
  held: Record<string, TypeQualificationCell["state"]>,
): TypeQualificationPilot {
  return {
    pilot: { id, full_name, email: `${id}@example.test` },
    station,
    cells: TYPES.flatMap((t) =>
      POSITIONS.map((p) => ({
        airframe_type: t,
        position: p,
        state: held[`${t}/${p}`] ?? "not_authorised",
        qualification_id: held[`${t}/${p}`] ? `q-${id}-${t}-${p}` : null,
        authorised_on: held[`${t}/${p}`] ? "2026-01-10" : null,
        checks: [
          {
            check: "competency",
            status: "upcoming",
            last_on: "2026-01-12",
            base_month_due: "2027-01-01",
            grace_month_end: "2027-02-28",
          },
        ],
      })),
    ),
  };
}

const GRID: TypeQualificationGrid = {
  airframe_types: TYPES,
  positions: POSITIONS,
  check_items: { competency: "c", instrument: "i" },
  pilots: [
    pilot("p1", "Ana Pilot", "PANC", {
      "caravan/pic": "current",
      "caravan/check_airman": "grace",
      "kingair/sic": "non_current",
    }),
    pilot("p2", "Ben Pilot", "PABE", { "kingair/pic": "current" }),
    pilot("p3", "Cy Pilot", null, {}),
  ],
};

async function renderPage(params: { station?: string } = {}) {
  const ui = await TypeQualificationsPage({ searchParams: Promise.resolve(params) });
  return render(ui);
}

function rowFor(name: string): HTMLElement {
  return screen.getByRole("link", { name }).closest("tr") as HTMLElement;
}

beforeEach(() => {
  getTypeQualificationGrid.mockReset();
  getTypeQualificationGrid.mockResolvedValue(GRID);
});

describe("/compliance/type-qualifications", () => {
  it("puts every pilot against every type, listing the positions they hold", async () => {
    await renderPage();
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["Pilot", "Base", "CARAVAN", "KINGAIR"]);

    const [, base, caravan, kingair] = within(rowFor("Ana Pilot")).getAllByRole("cell");
    expect(base).toHaveTextContent("PANC");
    expect(within(caravan).getByText("PIC").className).toContain("text-status-green");
    expect(within(caravan).getByText("CA").className).toContain("text-status-yellow");
    expect(within(kingair).getByText("SIC").className).toContain("text-status-red");
    expect(within(caravan).getByText("PIC")).toHaveAttribute(
      "title",
      expect.stringContaining("Competency check (135.293): last 2026-01-12, due 2027-01"),
    );

    // Nothing held on a type is a dash, and a pilot links to their page.
    const [, , cyCaravan] = within(rowFor("Cy Pilot")).getAllByRole("cell");
    expect(cyCaravan).toHaveTextContent("—");
    expect(screen.getByRole("link", { name: "Ben Pilot" })).toHaveAttribute(
      "href",
      "/compliance/pilots/p2",
    );
  });

  it("counts the authorised positions that are not current", async () => {
    await renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 authorised position is not current.",
    );
  });

  it("filters to a base and still offers every base", async () => {
    await renderPage({ station: "pabe" });
    expect(screen.queryByRole("link", { name: "Ana Pilot" })).toBeNull();
    expect(screen.getByRole("link", { name: "Ben Pilot" })).toBeInTheDocument();

    const filter = screen.getByRole("navigation", { name: "Filter by base" });
    const chips = within(filter).getAllByRole("link");
    expect(chips.map((c) => c.textContent)).toEqual(["All bases", "PABE", "PANC"]);
    expect(within(filter).getByRole("link", { name: "PABE" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Ben's position is current, so nothing on this base is lapsed.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says when the service is unavailable", async () => {
    getTypeQualificationGrid.mockRejectedValue(new TestApiError(503, "/ops", "down"));
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Aircraft qualifications are unavailable.",
    );
  });
});
