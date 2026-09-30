import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  TestApiError,
  changeGseStatus,
  completeGseMaintenance,
  createGseMaintenance,
  createGseSquawk,
  resolveGseSquawk,
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
    TestApiError,
    changeGseStatus: vi.fn(),
    completeGseMaintenance: vi.fn(),
    createGseMaintenance: vi.fn(),
    createGseSquawk: vi.fn(),
    resolveGseSquawk: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  changeGseStatus,
  completeGseMaintenance,
  createGseMaintenance,
  createGseSquawk,
  resolveGseSquawk,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  changeStatusAction,
  completeMaintenanceAction,
  reportSquawkAction,
  resolveSquawkAction,
  scheduleMaintenanceAction,
} from "./actions";

const UNIT = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const refused = () => new TestApiError(403, "/ground/gse", "insufficient_role");
const only = (what: string) => ({
  status: "api-error",
  message: `Only Ground Ops, the Director of Maintenance, the Director of Operations or an Exec Admin can ${what}.`,
});

beforeEach(() => {
  for (const fn of [
    changeGseStatus,
    completeGseMaintenance,
    createGseMaintenance,
    createGseSquawk,
    resolveGseSquawk,
  ]) {
    fn.mockReset().mockRejectedValue(refused());
  }
});

describe("equipment actions refused by role (29 Sep)", () => {
  it("status change says who can", async () => {
    expect(
      await changeStatusAction({ status: "idle" }, form({ unit_id: UNIT, status: "maintenance" })),
    ).toEqual(only("change equipment status"));
  });

  it("resolving a squawk says who can", async () => {
    expect(
      await resolveSquawkAction(
        { status: "idle" },
        form({ unit_id: UNIT, squawk_id: OTHER, resolution_notes: "Aired up" }),
      ),
    ).toEqual(only("resolve a squawk"));
  });

  it("scheduling maintenance says who can", async () => {
    expect(
      await scheduleMaintenanceAction(
        { status: "idle" },
        form({ unit_id: UNIT, title: "100hr", interval_hours: "100" }),
      ),
    ).toEqual(only("schedule equipment maintenance"));
  });

  it("completing maintenance says who can", async () => {
    expect(
      await completeMaintenanceAction(
        { status: "idle" },
        form({ unit_id: UNIT, mx_id: OTHER, completed_date: "2026-09-30" }),
      ),
    ).toEqual(only("complete equipment maintenance"));
  });

  it("reporting a squawk is open to all staff, so a 403 there claims no role", async () => {
    expect(
      await reportSquawkAction(
        { status: "idle" },
        form({ unit_id: UNIT, description: "Tire low", reported_date: "2026-09-30" }),
      ),
    ).toEqual({
      status: "api-error",
      message: "Action failed (HTTP 403). Try again in a moment.",
    });
  });
});
