import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { FlightListItem } from "@/lib/api/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { LoadFromSchedule } from "./load-from-schedule";

const baseFlight = (overrides: Partial<FlightListItem> = {}): FlightListItem => ({
  id: "f-1",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-05-31T14:00:00Z",
  scheduled_arrival_at: "2026-05-31T16:00:00Z",
  status: "scheduled",
  aircraft: {
    id: "ac-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
  ...overrides,
});

describe("LoadFromSchedule", () => {
  it("renders nothing when there are no flights (legacy parity)", () => {
    const { container } = render(<LoadFromSchedule flights={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders one option per flight (plus the empty default)", () => {
    render(
      <LoadFromSchedule
        flights={[
          baseFlight(),
          baseFlight({ id: "f-2", flight_number: "GV103", origin: "PANC", destination: "PAKN" }),
        ]}
      />,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3); // placeholder + 2
  });

  it("includes the demo PIC name in each option text", () => {
    render(<LoadFromSchedule flights={[baseFlight()]} />);
    const opt = screen
      .getAllByRole("option")
      .find((o) => o.getAttribute("value") === "f-1");
    expect(opt?.textContent).toMatch(/GV101/);
    expect(opt?.textContent).toMatch(/PADU → PANC/);
    expect(opt?.textContent).toMatch(/N207GE/);
    expect(opt?.textContent).toMatch(/Brian Larson/);
  });

  it("updates the URL to /dispatch/?flight={id} when a flight is selected", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(<LoadFromSchedule flights={[baseFlight()]} />);
    await user.selectOptions(screen.getByRole("combobox"), "f-1");
    expect(push).toHaveBeenCalledWith("/dispatch/?flight=f-1");
  });

  it("clears the selection (navigates to /dispatch/) when placeholder is chosen", async () => {
    push.mockReset();
    const user = userEvent.setup();
    render(<LoadFromSchedule flights={[baseFlight()]} selectedFlightId="f-1" />);
    await user.selectOptions(screen.getByRole("combobox"), "");
    expect(push).toHaveBeenCalledWith("/dispatch/");
  });

  it("shows the supplied selectedFlightId as the current value", () => {
    render(
      <LoadFromSchedule
        flights={[baseFlight(), baseFlight({ id: "f-2", flight_number: "GV103" })]}
        selectedFlightId="f-2"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("f-2");
  });

  it("renders children below the dropdown (summary slot)", () => {
    render(
      <LoadFromSchedule flights={[baseFlight()]}>
        <div data-testid="summary-slot">summary content</div>
      </LoadFromSchedule>,
    );
    expect(screen.getByTestId("summary-slot")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <LoadFromSchedule flights={[baseFlight()]} />,
    );
    await expectNoA11yViolations(container);
  });
});
