import { describe, expect, it } from "vitest";

import type { StopWeather } from "@/lib/api/dispatch-risk";

import { sourceLabel } from "./weather-source";

function stop(over: Partial<StopWeather>): StopWeather {
  return { ident: "PAII", source: "metar", certified: true, described: "METAR", ...over } as StopWeather;
}

describe("where a stop's weather came from (#151)", () => {
  it("reads a current METAR as official, and names a worse reading beside it", () => {
    expect(sourceLabel(stop({}))).toBe("Official METAR/TAF");
    // The client, 29 Oct: "Metar at PAII is certified weather".
    expect(sourceLabel(stop({ described: "METAR, and the FAA WeatherCam estimate where worse" }))).toBe(
      "Official METAR/TAF, and the FAA WeatherCam estimate where worse",
    );
  });

  it("says Not certified for a stop with no current METAR", () => {
    expect(
      sourceLabel(stop({ source: "weathercam", certified: false, described: "FAA WeatherCam estimate, not certified" })),
    ).toBe("FAA WeatherCam estimate · Not certified");
  });
});
