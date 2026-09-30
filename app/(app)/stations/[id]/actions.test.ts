import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, createStationIssue, resolveStationIssue, updateStation } =
  vi.hoisted(() => {
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
      createStationIssue: vi.fn(),
      resolveStationIssue: vi.fn(),
      updateStation: vi.fn(),
    };
  });
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  createStationIssue,
  resolveStationIssue,
  updateStation,
  STATIONS_CACHE_TAG: "stations",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import {
  reportIssueAction,
  resolveIssueAction,
  setStationActiveAction,
} from "./actions";

const STATION = "11111111-1111-1111-1111-111111111111";
const ISSUE = "22222222-2222-2222-2222-222222222222";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const refused = () => new TestApiError(403, "/ground", "insufficient_role");

beforeEach(() => {
  createStationIssue.mockReset();
  resolveStationIssue.mockReset();
  updateStation.mockReset();
});

describe("station actions refused by role (29 Sep)", () => {
  it("resolving says who can", async () => {
    resolveStationIssue.mockRejectedValueOnce(refused());
    const state = await resolveIssueAction(
      { status: "idle" },
      form({ station_id: STATION, issue_id: ISSUE, resolution_notes: "Fixed" }),
    );
    expect(state).toEqual({
      status: "api-error",
      message:
        "Only Ground Ops, the Director of Operations or an Exec Admin can resolve a station issue.",
    });
  });

  it("deactivating says who can", async () => {
    updateStation.mockRejectedValueOnce(refused());
    expect(await setStationActiveAction(STATION, false)).toEqual({
      ok: false,
      error:
        "Only Ground Ops, the Director of Operations or an Exec Admin can deactivate or reactivate a station.",
    });
  });

  it("reporting is open to all staff, so a 403 there claims no role", async () => {
    createStationIssue.mockRejectedValueOnce(refused());
    const state = await reportIssueAction(
      { status: "idle" },
      form({ station_id: STATION, title: "Lights out", description: "Taxiway B" }),
    );
    expect(state).toEqual({
      status: "api-error",
      message: "Action failed (HTTP 403). Try again in a moment.",
    });
  });
});
