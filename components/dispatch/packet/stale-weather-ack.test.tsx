import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RouteFreshness, StationFreshness } from "@/lib/api/types";

import { StaleWeatherAck } from "./stale-weather-ack";

const replace = vi.fn();
const save = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/app/(app)/dispatch/ack-actions", () => ({
  saveAcknowledgmentsAction: (...args: unknown[]) => save(...args),
}));

function station(overrides: Partial<StationFreshness> = {}): StationFreshness {
  return {
    icao: "PANC",
    metar_age_minutes: 10,
    metar_stale: false,
    field_report_age_minutes: null,
    field_report_stale: false,
    has_any_weather: true,
    requires_acknowledgment: false,
    ...overrides,
  };
}

function freshness(overrides: Partial<RouteFreshness> = {}): RouteFreshness {
  return {
    stations: [],
    any_stale_metar: false,
    any_stale_field_report: false,
    any_missing_weather: false,
    acknowledgment_required: false,
    stations_requiring_acknowledgment: [],
    ...overrides,
  };
}

describe("StaleWeatherAck", () => {
  it("renders nothing when the route's weather is current", () => {
    // No checkbox to click past out of habit on a clean route.
    const { container } = render(
      <StaleWeatherAck flightId="f-1" freshness={freshness()} acknowledged={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the freshness call failed", () => {
    // Matches the release gate, which also declines to act on a verdict
    // it could not obtain.
    const { container } = render(
      <StaleWeatherAck flightId="f-1" freshness={null} acknowledged={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the checkbox when an acknowledgment is required", () => {
    render(
      <StaleWeatherAck
        flightId="f-1"
        freshness={freshness({
          acknowledgment_required: true,
          any_stale_metar: true,
          stations: [
            station({
              metar_stale: true,
              metar_age_minutes: 75,
              requires_acknowledgment: true,
            }),
          ],
        })}
        acknowledged={false}
      />,
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByText(/acknowledge stale or missing weather/i)).toBeInTheDocument();
  });

  it("names the offending stop and how old its METAR is", () => {
    render(
      <StaleWeatherAck
        flightId="f-1"
        freshness={freshness({
          acknowledgment_required: true,
          stations: [
            station({
              icao: "PADU",
              metar_stale: true,
              metar_age_minutes: 75,
              requires_acknowledgment: true,
            }),
          ],
        })}
        acknowledged={false}
      />,
    );
    expect(screen.getByText(/PADU: METAR 75 min old/)).toBeInTheDocument();
  });

  it("reports a missing observation distinctly from a stale one", () => {
    render(
      <StaleWeatherAck
        flightId="f-1"
        freshness={freshness({
          acknowledgment_required: true,
          stations: [
            station({
              icao: "PAKN",
              metar_age_minutes: null,
              has_any_weather: false,
              requires_acknowledgment: true,
            }),
          ],
        })}
        acknowledged={false}
      />,
    );
    expect(screen.getByText(/PAKN: no METAR or village report/)).toBeInTheDocument();
  });

  it("renders long ages in hours rather than making the reader divide", () => {
    render(
      <StaleWeatherAck
        flightId="f-1"
        freshness={freshness({
          acknowledgment_required: true,
          stations: [
            station({
              icao: "PADU",
              metar_stale: true,
              metar_age_minutes: 142,
              requires_acknowledgment: true,
            }),
          ],
        })}
        acknowledged={false}
      />,
    );
    expect(screen.getByText(/2 hr 22 min old/)).toBeInTheDocument();
  });

  it("shows as checked once acknowledged", () => {
    render(
      <StaleWeatherAck
        flightId="f-1"
        freshness={freshness({
          acknowledgment_required: true,
          stations: [station({ metar_stale: true, requires_acknowledgment: true })],
        })}
        acknowledged
      />,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("saves the acknowledgment for the dispatcher when ticked (#155), not in the URL", async () => {
    save.mockClear();
    render(
      <StaleWeatherAck
        flightId="f-1"
        freshness={freshness({
          acknowledgment_required: true,
          stations: [station({ metar_stale: true, requires_acknowledgment: true })],
          stations_requiring_acknowledgment: ["PANC"],
        })}
        acknowledged={false}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    await vi.waitFor(() =>
      expect(save).toHaveBeenCalledWith("f-1", [
        { kind: "stale_weather", key: "route", on: true, detail: { stations: ["PANC"] } },
      ]),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("withdraws it when unticked", async () => {
    save.mockClear();
    render(
      <StaleWeatherAck
        flightId="f-1"
        freshness={freshness({
          acknowledgment_required: true,
          stations: [station({ metar_stale: true, requires_acknowledgment: true })],
        })}
        acknowledged
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    await vi.waitFor(() =>
      expect(save).toHaveBeenCalledWith("f-1", [
        expect.objectContaining({ kind: "stale_weather", key: "route", on: false }),
      ]),
    );
  });

  it("still renders when no station explains why", () => {
    // Defensive: a verdict that requires an ack but names no station
    // must not produce an empty description.
    render(
      <StaleWeatherAck
        flightId="f-1"
        freshness={freshness({ acknowledgment_required: true, stations: [] })}
        acknowledged={false}
      />,
    );
    expect(screen.getByText(/review the weather panel/i)).toBeInTheDocument();
  });
});
