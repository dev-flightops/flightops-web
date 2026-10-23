import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeatherMinimumsView } from "@/lib/api/types";

import { WeatherMinimumsNotice } from "./weather-minimums-notice";

const MET: WeatherMinimumsView = {
  applies: true,
  airframe_type: "ga8",
  min_ceiling_ft: 600,
  min_visibility_sm: "2.0",
  below: false,
  stations: [
    {
      icao: "PABE",
      below: false,
      observations: [
        {
          source: "metar",
          observed_at: null,
          ceiling_ft: 900,
          visibility_sm: 4,
          below_ceiling: false,
          below_visibility: false,
        },
      ],
    },
    { icao: "PAKI", below: false, observations: [] },
  ],
};

describe("WeatherMinimumsNotice (#89)", () => {
  it("says nothing for an aircraft the company hasn't listed", () => {
    const { container } = render(
      <WeatherMinimumsNotice minimums={{ ...MET, applies: false }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says the rule applied and was met, and where there was nothing to check", () => {
    render(<WeatherMinimumsNotice minimums={MET} />);
    expect(screen.getByText(/The GA8 is not IFR certified/)).toHaveTextContent(
      "600 ft / 2 sm at every stop, and met on the latest weather (no current report at PAKI)",
    );
  });

  it("raises an alert below them, naming the stop", () => {
    render(
      <WeatherMinimumsNotice
        minimums={{
          ...MET,
          below: true,
          stations: [
            {
              icao: "PABE",
              below: true,
              observations: [
                {
                  source: "metar",
                  observed_at: null,
                  ceiling_ft: 500,
                  visibility_sm: 4,
                  below_ceiling: true,
                  below_visibility: false,
                },
              ],
            },
          ],
        }}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Below company minimums");
    expect(alert).toHaveTextContent("PABE ceiling 500 ft.");
    expect(alert).toHaveTextContent("can’t be released until the weather comes up");
  });
});
