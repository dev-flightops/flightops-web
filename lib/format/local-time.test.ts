import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIME_ZONE,
  localClock,
  localDate,
  localDateTime,
  localDay,
  localToUtcIso,
  utcToLocalInput,
  zoneAbbreviation,
  zoneFor,
  zoneTable,
  zuluHint,
} from "./local-time";

const ALASKA = "America/Anchorage";

describe("zoneTable / zoneFor", () => {
  const table = zoneTable([
    { icao: "pabe", timezone: "America/Anchorage" },
    { icao: "PADK", timezone: "America/Adak" },
    { icao: "PAOM", timezone: null },
    { icao: "PAOT", timezone: "Alaska/Nowhere" },
  ]);

  it("uses the departure base's zone", () => {
    expect(zoneFor(table, "PABE")).toBe(ALASKA);
    expect(zoneFor(table, "padk")).toBe("America/Adak");
  });

  it("uses a base's zone for any other airport, as the dispatch packet does", () => {
    expect(zoneFor(table, "PAVA")).toBe(ALASKA);
    expect(zoneFor(table, "PAOM")).toBe(ALASKA);
    expect(zoneFor(table, "")).toBe(ALASKA);
  });

  it("ignores a zone that does not exist", () => {
    expect(table.byIcao.PAOT).toBeUndefined();
  });

  it("falls back to Alaska when no base has a zone", () => {
    expect(zoneFor(zoneTable([{ icao: "PANC", timezone: null }]), "PANC")).toBe(DEFAULT_TIME_ZONE);
  });
});

describe("localToUtcIso", () => {
  it("reads the client's 11:30am at Bethel as Alaska time, not Zulu", () => {
    // The flight was stored as 11:30Z, 03:30 local, and scored as night.
    expect(localToUtcIso("2026-10-11T11:30", ALASKA)).toBe("2026-10-11T19:30:00Z");
  });

  it("follows daylight saving: Alaska is UTC-9 in winter", () => {
    expect(localToUtcIso("2026-12-15T11:30", ALASKA)).toBe("2026-12-15T20:30:00Z");
  });

  it("carries an evening departure into the next UTC day", () => {
    expect(localToUtcIso("2026-10-11T18:45", ALASKA)).toBe("2026-10-12T02:45:00Z");
  });

  it("is null for anything that is not a datetime-local value", () => {
    expect(localToUtcIso("", ALASKA)).toBeNull();
    expect(localToUtcIso("11:30", ALASKA)).toBeNull();
    expect(localToUtcIso("2026-10-11T11:30Z", ALASKA)).toBeNull();
  });
});

describe("utcToLocalInput", () => {
  it("turns a stored time back into what the dispatcher typed", () => {
    expect(utcToLocalInput("2026-10-11T19:30:00Z", ALASKA)).toBe("2026-10-11T11:30");
    expect(utcToLocalInput("2026-12-15T20:30:00Z", ALASKA)).toBe("2026-12-15T11:30");
    expect(localToUtcIso(utcToLocalInput("2026-10-12T02:45:00Z", ALASKA), ALASKA)).toBe(
      "2026-10-12T02:45:00Z",
    );
  });

  it("is blank for a value that is not a time", () => {
    expect(utcToLocalInput("not a time", ALASKA)).toBe("");
  });
});

describe("localDay", () => {
  // #101: 8 pm on the 28th in Alaska is already the 29th in UTC.
  it("is the day there, not UTC's", () => {
    expect(localDay(ALASKA, new Date("2026-10-29T04:00:00Z"))).toBe("2026-10-28");
    expect(localDay("UTC", new Date("2026-10-29T04:00:00Z"))).toBe("2026-10-29");
  });

  it("turns over at local midnight", () => {
    expect(localDay(ALASKA, new Date("2026-10-29T07:59:00Z"))).toBe("2026-10-28");
    expect(localDay(ALASKA, new Date("2026-10-29T08:00:00Z"))).toBe("2026-10-29");
    // AKST from 1 Nov: midnight is 09:00Z.
    expect(localDay(ALASKA, new Date("2026-12-15T08:30:00Z"))).toBe("2026-12-14");
  });
});

describe("labels", () => {
  it("names the zone as dispatchers read it", () => {
    expect(zoneAbbreviation(ALASKA, new Date("2026-10-11T19:30:00Z"))).toBe("AKDT");
    expect(zoneAbbreviation(ALASKA, new Date("2026-12-15T20:30:00Z"))).toBe("AKST");
  });

  it("shows an instant on the local clock", () => {
    expect(localClock("2026-10-11T19:30:00Z", ALASKA)).toBe("11:30 AKDT");
  });

  it("shows a typed time in Zulu, with the UTC date", () => {
    expect(zuluHint("2026-10-11T18:45", ALASKA)).toBe("= 02:45Z 2026-10-12");
    expect(zuluHint("", ALASKA)).toBe("");
  });
});

describe("localDate / localDateTime", () => {
  // 01:30Z on the 22nd is the evening of the 21st in Alaska.
  const evening = "2026-10-22T01:30:00Z";

  it("shows the day and time where it happened, not in UTC", () => {
    expect(localDateTime(evening, ALASKA)).toBe("Oct 21, 17:30 AKDT");
    expect(localDate(evening, ALASKA)).toBe("Oct 21");
  });

  it("adds the year when asked", () => {
    expect(localDateTime(evening, ALASKA, { withYear: true })).toBe("Oct 21, 2026, 17:30 AKDT");
    expect(localDate(evening, ALASKA, { withYear: true })).toBe("Oct 21, 2026");
  });

  it("reads an offset as the API sends it", () => {
    expect(localDateTime("2026-10-22T01:30:00+00:00", ALASKA)).toBe("Oct 21, 17:30 AKDT");
  });

  it("leaves a value it cannot read as it is", () => {
    expect(localDateTime("not a time", ALASKA)).toBe("not a time");
    expect(localDate("", ALASKA)).toBe("");
  });
});
