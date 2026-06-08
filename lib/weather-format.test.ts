import { describe, expect, it } from "vitest";

import type { WeatherReportResponse } from "@/lib/api/types";
import {
  fieldFormat,
  metarAge,
  metarSummary,
  routeRoleFor,
  utcHm,
} from "./weather-format";

function makeReport(
  overrides: Partial<WeatherReportResponse> = {},
): WeatherReportResponse {
  return {
    icao: "PADM",
    kind: "metar",
    raw: "METAR PADM 080056Z AUTO 27008G15KT 10SM BKN040 14/04 A2966 RMK AO2",
    parsed_at: "2026-06-07T15:53:00Z",
    valid_until: "2026-06-07T15:58:00Z",
    cache_hit: false,
    flight_category: "VFR",
    alternate_required: false,
    visibility_sm: 10.0,
    ceiling_ft: 4000,
    wind_direction_deg: 270,
    wind_speed_kt: 8,
    wind_gust_kt: 15,
    wind_variable: false,
    wind_calm: false,
    temp_c: 14,
    dewpoint_c: 4,
    altimeter_in_hg: 29.66,
    ...overrides,
  };
}

// ---- routeRoleFor -----------------------------------------------------------

describe("routeRoleFor", () => {
  it("returns null for a single-stop route", () => {
    expect(routeRoleFor(0, 1)).toBeNull();
  });

  it("returns DEPARTURE for the first stop, DESTINATION for the last", () => {
    expect(routeRoleFor(0, 3)).toBe("DEPARTURE");
    expect(routeRoleFor(2, 3)).toBe("DESTINATION");
  });

  it("returns EN ROUTE for intermediate stops", () => {
    expect(routeRoleFor(1, 3)).toBe("EN ROUTE");
    expect(routeRoleFor(2, 5)).toBe("EN ROUTE");
  });
});

// ---- metarAge ---------------------------------------------------------------

describe("metarAge", () => {
  const parsedAt = "2026-06-07T15:53:00Z";

  it("returns 'just now' when under 30 seconds old", () => {
    const now = new Date("2026-06-07T15:53:15Z"); // +15 s
    expect(metarAge(parsedAt, now)).toBe("just now");
  });

  it("returns '5 min' when 5 minutes old", () => {
    const now = new Date("2026-06-07T15:58:00Z"); // +5 min
    expect(metarAge(parsedAt, now)).toBe("5 min");
  });

  it("returns hours+minutes for >= 1 hour", () => {
    const now = new Date("2026-06-07T17:11:00Z"); // +1h 18min
    expect(metarAge(parsedAt, now)).toBe("1h 18m");
  });

  it("returns just hours when on the hour", () => {
    const now = new Date("2026-06-07T17:53:00Z"); // +2h exact
    expect(metarAge(parsedAt, now)).toBe("2h");
  });
});

// ---- utcHm ------------------------------------------------------------------

describe("utcHm", () => {
  it("formats as zero-padded HH:MMZ in UTC", () => {
    expect(utcHm("2026-06-07T01:49:00Z")).toBe("01:49Z");
    expect(utcHm("2026-06-07T15:53:00Z")).toBe("15:53Z");
  });
});

// ---- metarSummary -----------------------------------------------------------

describe("metarSummary", () => {
  it("produces the legacy-style sentence with all fields present", () => {
    const summary = metarSummary(makeReport());
    expect(summary).toBe(
      "Vfr, wind 270° at 8 kts, gusting 15, visibility 10.0 sm, ceiling 4000 ft, temp 14°c / dewpoint 4°c, altimeter 29.66 inhg",
    );
  });

  it("omits the gust phrase when wind has no gust", () => {
    const summary = metarSummary(makeReport({ wind_gust_kt: null }));
    expect(summary).toContain("wind 270° at 8 kts,");
    expect(summary).not.toContain("gusting");
  });

  it("uses 'wind calm' when wind_calm is true", () => {
    const summary = metarSummary(
      makeReport({
        wind_calm: true,
        wind_direction_deg: 0,
        wind_speed_kt: 0,
        wind_gust_kt: null,
      }),
    );
    expect(summary).toContain("wind calm");
  });

  it("uses 'variable' phrasing when wind_variable is true", () => {
    const summary = metarSummary(
      makeReport({
        wind_variable: true,
        wind_direction_deg: null,
        wind_speed_kt: 3,
        wind_gust_kt: null,
      }),
    );
    expect(summary).toContain("wind variable at 3 kts");
  });

  it("pads wind direction to 3 digits (e.g. 5° -> 005°)", () => {
    const summary = metarSummary(
      makeReport({ wind_direction_deg: 5, wind_gust_kt: null }),
    );
    expect(summary).toContain("wind 005° at 8 kts");
  });

  it("silently drops missing fields rather than rendering blank slots", () => {
    const summary = metarSummary(
      makeReport({
        flight_category: null,
        ceiling_ft: null,
        temp_c: null,
        dewpoint_c: null,
      }),
    );
    expect(summary).not.toContain("undefined");
    expect(summary).not.toContain("null");
    expect(summary).not.toContain("ceiling");
    expect(summary).not.toContain("temp");
    expect(summary).toContain("wind 270° at 8 kts");
  });

  it("sentence-cases each FAA category", () => {
    expect(metarSummary(makeReport({ flight_category: "VFR" }))).toMatch(/^Vfr/);
    expect(metarSummary(makeReport({ flight_category: "MVFR" }))).toMatch(/^Mvfr/);
    expect(metarSummary(makeReport({ flight_category: "IFR" }))).toMatch(/^Ifr/);
    expect(metarSummary(makeReport({ flight_category: "LIFR" }))).toMatch(/^Lifr/);
  });
});

// ---- fieldFormat ------------------------------------------------------------

describe("fieldFormat", () => {
  it("ceiling: ft suffix + comma separators", () => {
    expect(fieldFormat.ceiling(makeReport({ ceiling_ft: 4000 }))).toBe(
      "4,000 ft",
    );
  });

  it("ceiling: 'Unlimited' when null", () => {
    expect(fieldFormat.ceiling(makeReport({ ceiling_ft: null }))).toBe(
      "Unlimited",
    );
  });

  it("visibility: 1 decimal place + SM", () => {
    expect(fieldFormat.visibility(makeReport({ visibility_sm: 10 }))).toBe(
      "10.0 SM",
    );
    expect(fieldFormat.visibility(makeReport({ visibility_sm: 2.5 }))).toBe(
      "2.5 SM",
    );
  });

  it("visibility: dash when null", () => {
    expect(fieldFormat.visibility(makeReport({ visibility_sm: null }))).toBe(
      "—",
    );
  });

  it("wind: legacy aviation format", () => {
    expect(fieldFormat.wind(makeReport({ wind_gust_kt: null }))).toBe(
      "270° @ 8 kt",
    );
  });

  it("wind: with gust", () => {
    expect(fieldFormat.wind(makeReport())).toBe("270° @ 8G15 kt");
  });

  it("wind: variable", () => {
    expect(
      fieldFormat.wind(
        makeReport({
          wind_variable: true,
          wind_direction_deg: null,
          wind_gust_kt: null,
        }),
      ),
    ).toBe("VRB @ 8 kt");
  });

  it("wind: calm", () => {
    expect(
      fieldFormat.wind(
        makeReport({
          wind_calm: true,
          wind_direction_deg: 0,
          wind_speed_kt: 0,
          wind_gust_kt: null,
        }),
      ),
    ).toBe("Calm");
  });

  it("tempDew: both present", () => {
    expect(fieldFormat.tempDew(makeReport())).toBe("14°C / 4°C");
  });

  it("tempDew: dewpoint missing → temp only", () => {
    expect(fieldFormat.tempDew(makeReport({ dewpoint_c: null }))).toBe(
      "14°C",
    );
  });

  it("tempDew: negative values render with minus signs (not 'M' prefix)", () => {
    expect(
      fieldFormat.tempDew(makeReport({ temp_c: -3, dewpoint_c: -7 })),
    ).toBe("-3°C / -7°C");
  });

  it("altimeter: 2-decimal inHg", () => {
    expect(
      fieldFormat.altimeter(makeReport({ altimeter_in_hg: 29.66 })),
    ).toBe("29.66 inHg");
  });
});
