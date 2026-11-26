import { describe, expect, it, vi } from "vitest";

const { loadZoneTable } = vi.hoisted(() => ({ loadZoneTable: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));

import { companyToday } from "./company-today";

/** 23:30 on 30 Nov in Alaska: 08:30 on 1 Dec in UTC. */
const EVENING = new Date("2026-12-01T08:30:00Z");

describe("companyToday (code audit, 26 Nov)", () => {
  it("is the company's date on an Alaska evening, not UTC's", async () => {
    loadZoneTable.mockResolvedValueOnce({ byIcao: { PABE: "America/Anchorage" }, fallback: "America/Anchorage" });
    expect(await companyToday(EVENING)).toBe("2026-11-30");
  });

  it("is Alaska's when the company's bases can't be read", async () => {
    loadZoneTable.mockRejectedValueOnce(new Error("ops down"));
    expect(await companyToday(EVENING)).toBe("2026-11-30");
  });

  it("follows a company based in another zone", async () => {
    loadZoneTable.mockResolvedValueOnce({ byIcao: { PHNL: "Pacific/Honolulu" }, fallback: "Pacific/Honolulu" });
    expect(await companyToday(new Date("2026-12-01T09:30:00Z"))).toBe("2026-11-30");
  });
});
