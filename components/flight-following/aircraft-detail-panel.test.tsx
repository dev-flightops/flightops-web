import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PositionResponse } from "@/lib/api/types";

import { AircraftDetailPanel } from "./aircraft-detail-panel";

function makePos(
  overrides: Partial<PositionResponse> = {},
): PositionResponse {
  return {
    id: "pos-1",
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "Pilatus PC-12" },
    flight_id: null,
    latitude: 61.21,
    longitude: -149.9,
    altitude_ft: 8500,
    groundspeed_kt: 175,
    heading_deg: 90,
    source: "adsb",
    reported_at: "2026-06-15T20:30:00Z",
    received_at: "2026-06-15T20:30:30Z",
    ...overrides,
  };
}

function makeProps(
  overrides: {
    position?: PositionResponse;
    isTrackVisible?: boolean;
    isTrackLoading?: boolean;
  } = {},
) {
  return {
    position: overrides.position ?? makePos(),
    isTrackVisible: overrides.isTrackVisible ?? false,
    isTrackLoading: overrides.isTrackLoading ?? false,
    onClose: vi.fn(),
    onShowTrack: vi.fn(),
    onClearTrack: vi.fn(),
  };
}

describe("AircraftDetailPanel", () => {
  it("renders the tail number, model, and source pill", () => {
    render(<AircraftDetailPanel {...makeProps()} />);

    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByText(/pilatus pc-12/i)).toBeInTheDocument();
    // Source pill — ADSB rendered uppercase
    expect(screen.getByText(/^adsb$/i)).toBeInTheDocument();
  });

  it("renders altitude, speed, heading, position, and last-fix rows", () => {
    render(<AircraftDetailPanel {...makeProps()} />);

    expect(screen.getByText("8,500 ft")).toBeInTheDocument();
    expect(screen.getByText("175 kt")).toBeInTheDocument();
    // heading is zero-padded to 3 digits
    expect(screen.getByText("090°")).toBeInTheDocument();
    expect(screen.getByText("61.2100, -149.9000")).toBeInTheDocument();
    // last fix as Zulu (20:30Z)
    expect(screen.getByText("20:30z")).toBeInTheDocument();
  });

  it("renders em-dashes for null numeric fields", () => {
    render(
      <AircraftDetailPanel
        {...makeProps({
          position: makePos({
            altitude_ft: null,
            groundspeed_kt: null,
            heading_deg: null,
          }),
        })}
      />,
    );

    // Three rows render "—" (altitude, speed, heading).
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("shows the Open Dispatch Packet CTA when the position has a flight_id", () => {
    render(
      <AircraftDetailPanel
        {...makeProps({ position: makePos({ flight_id: "flight-42" }) })}
      />,
    );

    const cta = screen.getByRole("link", { name: /open dispatch packet/i });
    expect(cta).toHaveAttribute("href", "/dispatch?flight=flight-42");
  });

  it("shows the 'no flight plan' hint when flight_id is null", () => {
    render(<AircraftDetailPanel {...makeProps()} />);

    expect(
      screen.getByText(/no flight plan filed/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /open dispatch packet/i }),
    ).not.toBeInTheDocument();
  });

  it("renders Show flight track only when the aircraft has a flight and the track is hidden", () => {
    render(
      <AircraftDetailPanel
        {...makeProps({ position: makePos({ flight_id: "flight-1" }) })}
      />,
    );

    expect(
      screen.getByRole("button", { name: /show flight track/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /clear track/i }),
    ).not.toBeInTheDocument();
  });

  it("renders Clear track when the aircraft's track is currently shown", () => {
    render(
      <AircraftDetailPanel
        {...makeProps({
          position: makePos({ flight_id: "flight-1" }),
          isTrackVisible: true,
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: /clear track/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /show flight track/i }),
    ).not.toBeInTheDocument();
  });

  it("disables Show flight track + swaps copy to 'Loading track…' while loading", () => {
    render(
      <AircraftDetailPanel
        {...makeProps({
          position: makePos({ flight_id: "flight-1" }),
          isTrackLoading: true,
        })}
      />,
    );

    const btn = screen.getByRole("button", { name: /loading track/i });
    expect(btn).toBeDisabled();
  });

  it("invokes onClose when the X button is clicked", async () => {
    const props = makeProps();
    render(<AircraftDetailPanel {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: /close aircraft details/i }),
    );

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onShowTrack when Show flight track is clicked", async () => {
    const props = makeProps({ position: makePos({ flight_id: "flight-1" }) });
    render(<AircraftDetailPanel {...props} />);

    await userEvent.click(
      screen.getByRole("button", { name: /show flight track/i }),
    );

    expect(props.onShowTrack).toHaveBeenCalledTimes(1);
  });
});
