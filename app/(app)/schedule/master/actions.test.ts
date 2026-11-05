import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, api, revalidatePath, redirect } = vi.hoisted(() => {
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
    api: {
      addScheduleRoute: vi.fn(),
      changeScheduleRoute: vi.fn(),
      createSchedule: vi.fn(),
      publishSchedule: vi.fn(),
      removeScheduleRoute: vi.fn(),
      updateSchedule: vi.fn(),
      withdrawPublication: vi.fn(),
    },
    revalidatePath: vi.fn(),
    redirect: vi.fn((to: string) => {
      throw new Error(`NEXT_REDIRECT ${to}`);
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/master-schedule", () => api);
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));

import {
  createScheduleAction,
  publishAction,
  removeRouteAction,
  saveRouteAction,
  updateScheduleAction,
  withdrawAction,
} from "./actions";

const refused = (status: number, detail: unknown) =>
  new TestApiError(status, "/ops/master-schedule", JSON.stringify({ detail }));

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const one of Array.isArray(value) ? value : [value]) data.append(name, one);
  }
  return data;
}

const ROUTE = {
  template_id: "t-1",
  flight_number: "GV101",
  aircraft_id: "a-1",
  origin: "panc",
  leg_destination: ["pabe", "panc"],
  leg_departs: ["09:00", "11:00"],
  leg_arrives: ["10:30", "12:30"],
  dow: ["0", "1", "2"],
};
const start = { status: "idle" as const, attempt: 0 };

beforeEach(() => vi.clearAllMocks());

describe("saveRouteAction", () => {
  it("sends the rows as legs, each from where the last landed", async () => {
    api.addScheduleRoute.mockResolvedValue({ id: "r-1" });

    const state = await saveRouteAction(start, form({ ...ROUTE, is_ifr: "on", notes: " Morning " }));

    expect(state).toEqual({ status: "ok", attempt: 1 });
    expect(api.addScheduleRoute).toHaveBeenCalledWith("t-1", {
      flight_number: "GV101",
      aircraft_id: "a-1",
      legs: [
        { origin: "PANC", destination: "PABE", departs: "09:00", arrives: "10:30" },
        { origin: "PABE", destination: "PANC", departs: "11:00", arrives: "12:30" },
      ],
      days_of_week: [0, 1, 2],
      is_ifr: true,
      notes: "Morning",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/schedule/master/t-1");
  });

  it("changes the flight it was given", async () => {
    api.changeScheduleRoute.mockResolvedValue({ id: "r-1" });
    await saveRouteAction(start, form({ ...ROUTE, route_id: "r-1" }));
    expect(api.changeScheduleRoute).toHaveBeenCalledWith("t-1", "r-1", expect.objectContaining({ flight_number: "GV101" }));
    expect(api.addScheduleRoute).not.toHaveBeenCalled();
  });

  it.each([
    [{ flight_number: "" }, "Enter the flight number."],
    [{ aircraft_id: "" }, "Pick the aircraft."],
    [{ origin: "" }, "Enter where the flight leaves from."],
    [{ leg_destination: ["PABE", ""] }, "Leg 2 needs a destination."],
    [{ leg_departs: ["", "11:00"] }, "Leg 1 needs both its times."],
    [{ dow: [] }, "Pick at least one day it operates."],
  ])("says what is missing: %j", async (change, message) => {
    const state = await saveRouteAction(start, form({ ...ROUTE, ...change }));
    expect(state).toEqual({ status: "error", message, attempt: 1 });
    expect(api.addScheduleRoute).not.toHaveBeenCalled();
  });

  it.each([
    [refused(422, "arrival_must_be_after_departure"), /arrive after it leaves/],
    [refused(422, "legs_not_continuous"), /from where the last one landed/],
    [refused(409, "aircraft_not_active"), /isn't active/],
    [refused(422, { error: "unknown_airport", codes: ["ZZZZ"] }), /ZZZZ isn't an airport we know/],
    [new TestApiError(403, "/x", "{}"), /Only a dispatcher or an Exec Admin/],
    [new TestApiError(401, "/x", "{}"), /session expired/],
    [new TestApiError(500, "/x", "boom"), /not saved \(HTTP 500\)/],
    [new Error("network"), /Could not reach the server/],
  ])("words a refusal: %s", async (err, message) => {
    api.addScheduleRoute.mockRejectedValue(err);
    const state = await saveRouteAction(start, form(ROUTE));
    expect(state.status).toBe("error");
    expect(state.message).toMatch(message);
  });
});

describe("publishAction", () => {
  const dates = { template_id: "t-1", name: "Winter", start_date: "2026-11-09", end_date: "2026-11-13" };
  const result = { preview: true, flights: 5, by_flight: [], first_date: "2026-11-09", last_date: "2026-11-13", already_there: 0, problem_count: 0, problems: [], publication_id: null };

  it("previews unless told to publish, and refreshes nothing", async () => {
    api.publishSchedule.mockResolvedValue(result);
    const state = await publishAction(start, form({ ...dates, intent: "preview" }));
    expect(api.publishSchedule).toHaveBeenCalledWith("t-1", {
      name: "Winter",
      start_date: "2026-11-09",
      end_date: "2026-11-13",
      preview: true,
    });
    expect(state.status).toBe("preview");
    expect(state.result).toEqual(result);
    expect(state.values).toEqual({ name: "Winter", start_date: "2026-11-09", end_date: "2026-11-13" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("publishes when told to, and refreshes the Schedule", async () => {
    api.publishSchedule.mockResolvedValue({ ...result, preview: false, publication_id: "p-1" });
    const state = await publishAction(start, form({ ...dates, intent: "publish" }));
    expect(api.publishSchedule).toHaveBeenCalledWith("t-1", expect.objectContaining({ preview: false }));
    expect(state.status).toBe("published");
    expect(revalidatePath).toHaveBeenCalledWith("/schedule");
    expect(revalidatePath).toHaveBeenCalledWith("/schedule/master/t-1");
  });

  it("wants both dates", async () => {
    const state = await publishAction(start, form({ ...dates, end_date: "" }));
    expect(state.status).toBe("error");
    expect(api.publishSchedule).not.toHaveBeenCalled();
  });

  it.each([
    ["start_in_past", /can't be before today/],
    ["end_before_start", /can't be before the start/],
    ["range_too_long", /a year at most/],
    ["schedule_inactive", /inactive/],
    ["schedule_has_no_flights", /Add a flight/],
    ["flight_number_conflict", /Preview again/],
  ])("words %s", async (detail, message) => {
    api.publishSchedule.mockRejectedValue(refused(422, detail));
    const state = await publishAction(start, form(dates));
    expect(state.message).toMatch(message);
    expect(state.values?.start_date).toBe("2026-11-09");
  });

  it("says how many is too many", async () => {
    api.publishSchedule.mockRejectedValue(refused(422, { error: "too_many_flights", count: 3100, limit: 3000 }));
    const state = await publishAction(start, form(dates));
    expect(state.message).toBe("That would add 3100 flights, more than the 3000 one publication can. Publish a shorter range.");
  });
});

describe("the schedule itself", () => {
  it("goes to the new schedule's page", async () => {
    api.createSchedule.mockResolvedValue({ id: "t-9" });
    await expect(createScheduleAction(start, form({ name: " Winter ", description: "" }))).rejects.toThrow(
      "NEXT_REDIRECT /schedule/master/t-9",
    );
    expect(api.createSchedule).toHaveBeenCalledWith({ name: "Winter", description: null });
  });

  it("wants a name", async () => {
    expect((await createScheduleAction(start, form({ name: " " }))).status).toBe("error");
    expect((await updateScheduleAction(start, form({ template_id: "t-1", name: "" }))).status).toBe("error");
    expect(api.createSchedule).not.toHaveBeenCalled();
    expect(api.updateSchedule).not.toHaveBeenCalled();
  });

  it("an unticked box makes it inactive", async () => {
    api.updateSchedule.mockResolvedValue({});
    await updateScheduleAction(start, form({ template_id: "t-1", name: "Winter" }));
    expect(api.updateSchedule).toHaveBeenCalledWith("t-1", { name: "Winter", description: null, is_active: false });
    await updateScheduleAction(start, form({ template_id: "t-1", name: "Winter", is_active: "on" }));
    expect(api.updateSchedule).toHaveBeenLastCalledWith("t-1", { name: "Winter", description: null, is_active: true });
  });
});

describe("row actions", () => {
  it("say why they couldn't", async () => {
    api.removeScheduleRoute.mockRejectedValue(refused(404, "route_not_found"));
    expect(await removeRouteAction("t-1", "r-1")).toEqual({
      ok: false,
      error: "That flight is no longer on the schedule. Refresh the page.",
    });
    api.withdrawPublication.mockRejectedValue(refused(409, "publication_already_withdrawn"));
    expect(await withdrawAction("p-1", "t-1")).toEqual({
      ok: false,
      error: "That publication has already been withdrawn. Refresh the page.",
    });
  });

  it("withdrawing refreshes the Schedule", async () => {
    api.withdrawPublication.mockResolvedValue({ removed: 3, kept: 0 });
    expect(await withdrawAction("p-1", "t-1")).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/schedule");
  });
});
