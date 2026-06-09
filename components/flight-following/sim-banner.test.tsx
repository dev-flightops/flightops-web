import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PositionResponse } from "@/lib/api/types";

import { SimBanner } from "./sim-banner";

function makePos(source: PositionResponse["source"]): PositionResponse {
  return {
    id: `pos-${source}`,
    aircraft: { id: `ac-${source}`, tail_number: "N1", model: "C208" },
    flight_id: null,
    latitude: 61,
    longitude: -150,
    altitude_ft: null,
    groundspeed_kt: null,
    heading_deg: null,
    source,
    reported_at: "2026-06-15T12:00:00Z",
    received_at: "2026-06-15T12:00:30Z",
  };
}

describe("SimBanner", () => {
  it("renders the legacy copy when ANY position is simulated", () => {
    render(
      <SimBanner positions={[makePos("simulated"), makePos("adsb")]} />,
    );

    expect(
      screen.getByText(/simulation mode/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/aircraft positions are simulated/i),
    ).toBeInTheDocument();
  });

  it("renders nothing when every position is from a real feed", () => {
    const { container } = render(
      <SimBanner positions={[makePos("adsb"), makePos("gps"), makePos("manual")]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no positions at all", () => {
    const { container } = render(<SimBanner positions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
