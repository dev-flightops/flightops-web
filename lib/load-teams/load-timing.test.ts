import { describe, expect, it } from "vitest";

import { loadTiming } from "./load-timing";

const DEPARTS = "2026-11-03T13:00:00Z";
const t = (hhmm: string) => Date.parse(`2026-11-03T${hhmm}:00Z`);
const load = (started: string | null, completed: string | null) => ({
  load_started_at: started ? `2026-11-03T${started}:00Z` : null,
  load_completed_at: completed ? `2026-11-03T${completed}:00Z` : null,
  flight: { scheduled_departure_at: DEPARTS },
});

describe("the ramp timer (LOG-43)", () => {
  it("counts down to the departure before loading starts", () => {
    expect(loadTiming(load(null, null), t("12:35"))).toEqual({ text: "Not started, departs in 25 min", late: false });
    expect(loadTiming(load(null, null), t("13:00"))).toEqual({ text: "Not started, departs now", late: false });
    expect(loadTiming(load(null, null), t("13:10"))).toEqual({ text: "Not started, departure was 10 min ago", late: true });
  });

  it("times the loading as it goes", () => {
    expect(loadTiming(load("12:40", null), t("12:52"))).toEqual({ text: "Loading 12 min, departs in 8 min", late: false });
    expect(loadTiming(load("11:40", null), t("13:05"))).toEqual({
      text: "Loading 1 h 25 min, departure was 5 min ago",
      late: true,
    });
  });

  it("says how long it took and how it stood against the departure", () => {
    expect(loadTiming(load("12:30", "12:48"), t("14:00"))).toEqual({
      text: "Loaded in 18 min, 12 min before departure",
      late: false,
    });
    expect(loadTiming(load(null, "11:00"), t("14:00"))).toEqual({ text: "Loaded 2 h before departure", late: false });
    expect(loadTiming(load("12:55", "13:04"), t("14:00"))).toEqual({
      text: "Loaded in 9 min, 4 min after the scheduled departure",
      late: true,
    });
    expect(loadTiming(load(null, "13:00"), t("14:00"))).toEqual({ text: "Loaded at departure", late: false });
  });
});
