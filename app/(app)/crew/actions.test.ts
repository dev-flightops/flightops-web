import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createRosterEntry,
  replaceRosterEntry,
  deleteRosterEntry,
  moveCrewHomeStation,
  createScheduleTag,
  updateScheduleTag,
  paintCrewDays,
  revalidatePath,
  TestApiError,
} = vi.hoisted(() => {
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
    createRosterEntry: vi.fn(),
    replaceRosterEntry: vi.fn(),
    deleteRosterEntry: vi.fn(),
    moveCrewHomeStation: vi.fn(),
    createScheduleTag: vi.fn(),
    updateScheduleTag: vi.fn(),
    paintCrewDays: vi.fn(),
    revalidatePath: vi.fn(),
    TestApiError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
// Keep the module's constants; replace only the calls.
vi.mock("@/lib/api/crew-calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/crew-calendar")>()),
  createRosterEntry,
  replaceRosterEntry,
  deleteRosterEntry,
  moveCrewHomeStation,
  createScheduleTag,
  updateScheduleTag,
  paintCrewDays,
}));

import {
  createTagAction,
  deleteAssignmentAction,
  moveHomeBaseAction,
  paintDaysAction,
  saveAssignmentAction,
  updateTagAction,
} from "./actions";

const PILOT = "8f6d3a1e-4c1b-4a7e-9a7e-1d2c3b4a5f60";
const ENTRY = "1b2c3d4e-5f60-4a7e-8a7e-9d2c3b4a5f61";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID = {
  user_id: PILOT,
  station: " pabe ",
  duty_type: "flying",
  airframe_type: "Caravan",
  aircraft_id: "",
  start_date: "2026-10-05",
  end_date: "2026-10-11",
  notes: "  ",
};

const SENT = {
  user_id: PILOT,
  station: "PABE",
  duty_type: "flying",
  airframe_type: "caravan",
  aircraft_id: null,
  start_date: "2026-10-05",
  end_date: "2026-10-11",
  notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveAssignmentAction", () => {
  it("creates with a normalised body and refreshes the calendar", async () => {
    createRosterEntry.mockResolvedValue({});
    expect(await saveAssignmentAction(form(VALID))).toEqual({ ok: true });
    expect(createRosterEntry).toHaveBeenCalledWith(SENT);
    expect(replaceRosterEntry).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/crew");
  });

  it("replaces when the form carries an entry id", async () => {
    replaceRosterEntry.mockResolvedValue({});
    expect(
      await saveAssignmentAction(form({ ...VALID, entry_id: ENTRY })),
    ).toEqual({ ok: true });
    expect(replaceRosterEntry).toHaveBeenCalledWith(ENTRY, SENT);
    expect(createRosterEntry).not.toHaveBeenCalled();
  });

  it.each([
    [{ end_date: "2026-10-04" }, "The end date is before the start date."],
    [{ airframe_type: "" }, "A flying assignment needs an aircraft type."],
    [{ user_id: "" }, "Pick a pilot."],
    [{ station: "" }, "Pick a base."],
  ])("refuses %o before calling the API", async (change, message) => {
    expect(await saveAssignmentAction(form({ ...VALID, ...change }))).toEqual({
      ok: false,
      error: message,
    });
    expect(createRosterEntry).not.toHaveBeenCalled();
  });

  it("lets an off day go without an aircraft type", async () => {
    createRosterEntry.mockResolvedValue({});
    const result = await saveAssignmentAction(
      form({ ...VALID, duty_type: "off", airframe_type: "" }),
    );
    expect(result).toEqual({ ok: true });
    expect(createRosterEntry).toHaveBeenCalledWith({
      ...SENT,
      duty_type: "off",
      airframe_type: null,
    });
  });

  it("shows the server's overlap message as it comes", async () => {
    const message =
      "Alice Pilot already has a flying assignment at PABE from 5 Oct 2026 to 11 Oct 2026.";
    createRosterEntry.mockRejectedValue(
      new TestApiError(409, "/ops/crew-calendar/entries", JSON.stringify({ detail: message })),
    );
    expect(await saveAssignmentAction(form(VALID))).toEqual({
      ok: false,
      error: message,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says who may edit on a 403", async () => {
    createRosterEntry.mockRejectedValue(
      new TestApiError(403, "/ops/crew-calendar/entries", '{"detail":"Forbidden"}'),
    );
    expect(await saveAssignmentAction(form(VALID))).toEqual({
      ok: false,
      error:
        "Only a Chief Pilot, Director of Operations or Exec Admin can change the crew calendar.",
    });
  });

  it("does not show FastAPI's validation list as a sentence", async () => {
    createRosterEntry.mockRejectedValue(
      new TestApiError(422, "/ops/crew-calendar/entries", '{"detail":[{"msg":"x"}]}'),
    );
    expect(await saveAssignmentAction(form(VALID))).toEqual({
      ok: false,
      error: "Couldn't save the assignment (HTTP 422). Try again.",
    });
  });
});

describe("deleteAssignmentAction and moveHomeBaseAction", () => {
  it("removes an assignment", async () => {
    deleteRosterEntry.mockResolvedValue(undefined);
    expect(await deleteAssignmentAction(ENTRY)).toEqual({ ok: true });
    expect(deleteRosterEntry).toHaveBeenCalledWith(ENTRY);
    expect(revalidatePath).toHaveBeenCalledWith("/crew");
  });

  it("moves a pilot, upper-casing the code", async () => {
    moveCrewHomeStation.mockResolvedValue({});
    expect(await moveHomeBaseAction(PILOT, " panc ")).toEqual({ ok: true });
    expect(moveCrewHomeStation).toHaveBeenCalledWith(PILOT, "PANC");
  });

  it("passes on the server's message for an unknown base", async () => {
    const message = "PAKN is not one of your bases. Add it under Settings → Bases first.";
    moveCrewHomeStation.mockRejectedValue(
      new TestApiError(422, "/ops/crew-calendar/crew/x/station", JSON.stringify({ detail: message })),
    );
    expect(await moveHomeBaseAction(PILOT, "PAKN")).toEqual({ ok: false, error: message });
  });
});

describe("day tag actions", () => {
  it("adds a tag with its label tidied", async () => {
    createScheduleTag.mockResolvedValue({});
    expect(await createTagAction("  FLY   day ", "blue")).toEqual({ ok: true });
    expect(createScheduleTag).toHaveBeenCalledWith({ label: "FLY day", tone: "blue" });
    expect(revalidatePath).toHaveBeenCalledWith("/crew");
  });

  it.each([
    ["   ", "blue", "Give the tag a label."],
    ["A".repeat(17), "blue", "Keep the label to 16 characters."],
    ["FLY", "magenta", "Pick a colour."],
  ])("refuses %j / %j before calling the API", async (label, tone, error) => {
    expect(await createTagAction(label, tone)).toEqual({ ok: false, error });
    expect(createScheduleTag).not.toHaveBeenCalled();
  });

  it("sends only what changed, and passes on a clash", async () => {
    updateScheduleTag.mockResolvedValue({});
    expect(await updateTagAction("t1", { is_active: false })).toEqual({ ok: true });
    expect(updateScheduleTag).toHaveBeenCalledWith("t1", { is_active: false });

    const message = "There is already a tag called OFF.";
    updateScheduleTag.mockRejectedValue(
      new TestApiError(409, "/ops/crew-calendar/tags/t1", JSON.stringify({ detail: message })),
    );
    expect(await updateTagAction("t1", { label: "OFF", tone: "gray" })).toEqual({
      ok: false,
      error: message,
    });
  });

  it("paints a run in date order, and clears with null", async () => {
    paintCrewDays.mockResolvedValue({ days: 5, tag_id: "t1" });
    expect(await paintDaysAction(PILOT, "2026-10-09", "2026-10-05", "t1")).toEqual({ ok: true });
    expect(paintCrewDays).toHaveBeenCalledWith({
      user_id: PILOT,
      start_date: "2026-10-05",
      end_date: "2026-10-09",
      tag_id: "t1",
    });
    await paintDaysAction(PILOT, "2026-10-05", "2026-10-05", null);
    expect(paintCrewDays).toHaveBeenLastCalledWith({
      user_id: PILOT,
      start_date: "2026-10-05",
      end_date: "2026-10-05",
      tag_id: null,
    });
  });

  it("explains a refused paint", async () => {
    const message = "STANDBY is archived. Restore it to paint with it.";
    paintCrewDays.mockRejectedValue(
      new TestApiError(422, "/ops/crew-calendar/cells", JSON.stringify({ detail: message })),
    );
    expect(await paintDaysAction(PILOT, "2026-10-05", "2026-10-06", "t1")).toEqual({
      ok: false,
      error: message,
    });
    expect(await paintDaysAction(PILOT, "05/10/2026", "2026-10-06", "t1")).toEqual({
      ok: false,
      error: "Pick the days again.",
    });
  });
});
