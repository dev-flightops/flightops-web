import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MxRoster } from "@/lib/api/mx-roster";

const { getMxRoster, auth } = vi.hoisted(() => ({
  getMxRoster: vi.fn(),
  auth: vi.fn(async () => ({ roles: ["maintenance"] as string[] })),
}));
vi.mock("@/lib/api/mx-roster", () => ({ getMxRoster }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("./actions", () => ({
  createRosterTagAction: vi.fn(),
  updateRosterTagAction: vi.fn(),
  paintRosterDaysAction: vi.fn(),
}));

import MechanicRosterPage from "./page";

function roster(over: Partial<MxRoster> = {}): MxRoster {
  return {
    month: "2026-11",
    first_day: "2026-11-01",
    last_day: "2026-11-30",
    today: "2026-11-09",
    base: null,
    bases: ["PABE", "PADQ"],
    mechanics: [
      { user_id: "u-1", full_name: "Mechanic Tester", station: "PABE", title: "Lead AMT" },
      { user_id: "u-2", full_name: "Dana DOM", station: "PADQ", title: null },
    ],
    tags: [{ id: "t-1", label: "ON", tone: "green", sort_order: 10, is_active: true }],
    cells: [{ user_id: "u-1", cell_date: "2026-11-02", tag_id: "t-1" }],
    ...over,
  };
}

async function show(params: Record<string, string> = {}) {
  render(await MechanicRosterPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  auth.mockResolvedValue({ roles: ["maintenance"] });
});

describe("Mechanic Roster (#178)", () => {
  it("shows each mechanic's month under their base, with the painted days", async () => {
    getMxRoster.mockResolvedValue(roster());
    await show({ month: "2026-11" });
    expect(getMxRoster).toHaveBeenCalledWith({ month: "2026-11", base: undefined });
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /PABE/ })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /Mechanic Tester/ })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /Dana DOM/ })).toBeInTheDocument();
    expect(screen.getByTitle("ON")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PADQ" })).toHaveAttribute("href", "/maintenance/roster?month=2026-11&base=PADQ");
    expect(screen.getByRole("link", { name: "Previous month" })).toHaveAttribute("href", "/maintenance/roster?month=2026-10");
  });

  it("gives the shop the palette and others the legend", async () => {
    getMxRoster.mockResolvedValue(roster());
    await show();
    expect(screen.getByRole("button", { name: /\+ Tag|New tag|Add tag/i })).toBeInTheDocument();

    document.body.innerHTML = "";
    auth.mockResolvedValue({ roles: ["pilot"] });
    await show();
    expect(screen.queryByRole("button", { name: /\+ Tag|New tag|Add tag/i })).not.toBeInTheDocument();
  });

  it("says who appears when there are no mechanics", async () => {
    getMxRoster.mockResolvedValue(roster({ mechanics: [], bases: [], cells: [] }));
    await show();
    expect(screen.getByText(/Maintenance or Director of Maintenance role/)).toBeInTheDocument();
  });
});
