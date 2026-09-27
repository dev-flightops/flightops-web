import { beforeEach, describe, expect, it, vi } from "vitest";

const { assignFlightToTeam, unassignFlight, revalidatePath, TestApiError } =
  vi.hoisted(() => {
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
    return {
      assignFlightToTeam: vi.fn(),
      unassignFlight: vi.fn(),
      revalidatePath: vi.fn(),
      TestApiError,
    };
  });

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/ground", () => ({ assignFlightToTeam, unassignFlight }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));

import { assignFlightAction, unassignFlightAction } from "./assign-actions";

const FLIGHT = "11111111-1111-4111-8111-111111111111";
const TEAM = "22222222-2222-4222-8222-222222222222";
const IDLE = { status: "idle" } as const;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const conflict = (detail: string) =>
  new TestApiError(409, "/ground/flight-assignments", JSON.stringify({ detail }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assignFlightAction", () => {
  it("assigns and refreshes both pages that show the assignment", async () => {
    assignFlightToTeam.mockResolvedValue({});
    const result = await assignFlightAction(
      IDLE,
      form({ flight_id: FLIGHT, load_team_id: TEAM }),
    );
    expect(result).toEqual({ status: "ok" });
    expect(assignFlightToTeam).toHaveBeenCalledWith({
      flight_id: FLIGHT,
      load_team_id: TEAM,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/ramp-ops");
    expect(revalidatePath).toHaveBeenCalledWith("/dispatch");
  });

  it("refuses malformed ids without calling the API", async () => {
    const result = await assignFlightAction(
      IDLE,
      form({ flight_id: "nope", load_team_id: TEAM }),
    );
    expect(result).toEqual({
      status: "error",
      message: "Invalid flight or team id.",
    });
    expect(assignFlightToTeam).not.toHaveBeenCalled();
  });

  it("tells an inactive team apart from a lost race", async () => {
    assignFlightToTeam.mockRejectedValueOnce(conflict("load_team_inactive"));
    expect(
      await assignFlightAction(IDLE, form({ flight_id: FLIGHT, load_team_id: TEAM })),
    ).toEqual({
      status: "error",
      message: "That load team is inactive — pick another team.",
    });

    assignFlightToTeam.mockRejectedValueOnce(conflict("assignment_conflict_retry"));
    expect(
      await assignFlightAction(IDLE, form({ flight_id: FLIGHT, load_team_id: TEAM })),
    ).toEqual({
      status: "error",
      message:
        "Someone else assigned this flight at the same moment — refresh to see which team has it.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("unassignFlightAction", () => {
  it("clears and refreshes both pages", async () => {
    unassignFlight.mockResolvedValue(undefined);
    expect(await unassignFlightAction(IDLE, form({ flight_id: FLIGHT }))).toEqual({
      status: "ok",
    });
    expect(unassignFlight).toHaveBeenCalledWith(FLIGHT);
    expect(revalidatePath).toHaveBeenCalledWith("/ramp-ops");
    expect(revalidatePath).toHaveBeenCalledWith("/dispatch");
  });

  it("treats nothing-to-clear as done", async () => {
    unassignFlight.mockRejectedValue(new TestApiError(404, "/x", ""));
    expect(await unassignFlightAction(IDLE, form({ flight_id: FLIGHT }))).toEqual({
      status: "ok",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dispatch");
  });
});
