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

describe("WeatherMinimumsNotice — a field without an instrument approach (#110)", () => {
  const PAII: WeatherMinimumsView = {
    applies: true,
    airframe_type: "caravan",
    min_ceiling_ft: 600,
    min_visibility_sm: "2.0",
    below: true,
    stations: [
      {
        icao: "PAII",
        below: true,
        reason: "no_instrument_approach",
        observations: [
          {
            source: "field_report",
            observed_at: null,
            ceiling_ft: 500,
            visibility_sm: 3,
            below_ceiling: true,
            below_visibility: false,
          },
        ],
      },
    ],
  };

  it("says the field has no approach, not that the Caravan isn't IFR certified", () => {
    render(<WeatherMinimumsNotice minimums={PAII} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "PAII ceiling 500 ft (village report). There’s no instrument approach at PAII, so it’s reached VFR whatever the aircraft, and the company’s dispatch minimums there are 600 ft / 2 sm.",
    );
    expect(alert).not.toHaveTextContent(/not IFR certified/);
  });

  it("says where it held and was met", () => {
    render(
      <WeatherMinimumsNotice
        minimums={{
          ...PAII,
          below: false,
          stations: [{ ...PAII.stations[0], below: false, observations: [] }],
        }}
      />,
    );
    expect(
      screen.getByText(
        "No instrument approach at PAII: held to the company’s dispatch minimums of 600 ft / 2 sm there, and met on the latest weather (no current report at PAII).",
      ),
    ).toBeInTheDocument();
  });
});
