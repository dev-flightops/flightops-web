import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StationListItem } from "@/lib/api/types";

const { setStationRunwayAction } = vi.hoisted(() => ({ setStationRunwayAction: vi.fn() }));
vi.mock("./actions", () => ({ setStationRunwayAction }));

import { StationRunwayForm } from "./runway-form";

const station = (over: Partial<StationListItem> = {}): StationListItem =>
  ({
    id: "s-1",
    icao_code: "9Z8",
    runway_length_ft: null,
    runway_width_ft: null,
    runway_primary_name: null,
    runway_true_alignment_deg: null,
    runway_source: null,
    ...over,
  }) as StationListItem;

const FAA = {
  code: "9Z8",
  effective: "2026-10-29",
  runways: [{ name: "01/19", length_ft: 3284, width_ft: 60, true_alignment_deg: 26 }],
};

const field = (name: RegExp) => screen.getByLabelText(name) as HTMLInputElement;

beforeEach(() => {
  setStationRunwayAction.mockReset();
  setStationRunwayAction.mockResolvedValue({ ok: true });
});

describe("the FAA's figures", () => {
  it("are shown with their date, and say the matrix already uses them", () => {
    render(<StationRunwayForm station={station()} faa={FAA} />);
    expect(screen.getByText("01/19 · 3,284 × 60 ft · 26° true")).toBeInTheDocument();
    expect(screen.getByText("FAA airport file, 29 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText(/the risk matrix uses the FAA's figures/)).toBeInTheDocument();
  });

  it("Use fills the form, and only Save saves", async () => {
    render(<StationRunwayForm station={station()} faa={FAA} />);
    fireEvent.click(screen.getByRole("button", { name: "Use the FAA's figures for runway 01/19" }));
    expect(field(/Length/).value).toBe("3284");
    expect(field(/Width/).value).toBe("60");
    expect(field(/^Runway$/).value).toBe("01/19");
    expect(field(/Heading/).value).toBe("26");
    expect(setStationRunwayAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save runway" }));
    await waitFor(() =>
      expect(setStationRunwayAction).toHaveBeenCalledWith("s-1", {
        length_ft: 3284,
        width_ft: 60,
        primary_name: "01/19",
        true_alignment_deg: 26,
      }),
    );
  });

  it("a runway with no heading in the file leaves the heading blank", () => {
    render(
      <StationRunwayForm
        station={station({ runway_true_alignment_deg: 90 })}
        faa={{ ...FAA, runways: [{ name: "E/W", length_ft: 1200, width_ft: 40, true_alignment_deg: null }] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Use the FAA's figures for runway E/W" }));
    expect(field(/Heading/).value).toBe("");
  });

  it("says when the file has nothing for the airport", () => {
    render(<StationRunwayForm station={station()} faa={{ ...FAA, runways: [] }} />);
    expect(screen.getByText(/has no runway for this airport/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Use the FAA/ })).toBeNull();
  });

  it("works with no answer from the file", () => {
    render(<StationRunwayForm station={station()} faa={null} />);
    expect(screen.getByRole("button", { name: "Save runway" })).toBeInTheDocument();
  });
});

describe("typing it in", () => {
  it("a blank heading goes as none, so the FAA's figure is used", async () => {
    render(<StationRunwayForm station={station()} faa={FAA} />);
    fireEvent.change(field(/Length/), { target: { value: "3000" } });
    fireEvent.change(field(/Width/), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save runway" }));
    await waitFor(() =>
      expect(setStationRunwayAction).toHaveBeenCalledWith("s-1", {
        length_ft: 3000,
        width_ft: 50,
        primary_name: null,
        true_alignment_deg: null,
      }),
    );
  });

  it("opens with what's saved, and Clear clears the heading too", async () => {
    render(
      <StationRunwayForm
        station={station({
          runway_length_ft: 3284,
          runway_width_ft: 60,
          runway_primary_name: "01/19",
          runway_true_alignment_deg: 26,
          runway_source: "manual",
        })}
        faa={FAA}
      />,
    );
    expect(field(/Heading/).value).toBe("26");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() =>
      expect(setStationRunwayAction).toHaveBeenCalledWith("s-1", {
        length_ft: null,
        width_ft: null,
        primary_name: null,
        true_alignment_deg: null,
      }),
    );
    await waitFor(() => expect(field(/Heading/).value).toBe(""));
  });
});
