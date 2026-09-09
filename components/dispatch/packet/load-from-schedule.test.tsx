import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";
import type { FlightListItem } from "@/lib/api/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { LoadFromSchedule } from "./load-from-schedule";

const DATE = "2026-05-31";

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

function panel(props: Partial<React.ComponentProps<typeof LoadFromSchedule>> = {}) {
  return render(
    <LoadFromSchedule flights={[baseFlight()]} date={DATE} {...props} />,
  );
}

describe("LoadFromSchedule", () => {
  it("renders one option per flight (plus the empty default)", () => {
    panel({
      flights: [
        baseFlight(),
        baseFlight({
          id: "f-2",
          flight_number: "GV103",
          origin: "PANC",
          destination: "PAKN",
        }),
      ],
    });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3); // placeholder + 2
  });

  it("includes date, flight number, route, and tail in each option text", () => {
    // Option label used to append a placeholder chief-pilot name too;
    // dropped because Flight has no pilot_id column yet and rendering
    // a hardcoded pilot misled dispatchers into skipping the PIC
    // picker on the packet itself.
    panel();
    const opt = screen
      .getAllByRole("option")
      .find((o) => o.getAttribute("value") === "f-1");
    expect(opt?.textContent).toMatch(/GV101/);
    expect(opt?.textContent).toMatch(/PADU → PANC/);
    expect(opt?.textContent).toMatch(/N207GE/);
    expect(opt?.textContent).not.toMatch(/Sarah Kessler/);
  });

  it("keeps the day in the URL when a flight is selected", async () => {
    push.mockReset();
    const user = userEvent.setup();
    panel();
    await user.selectOptions(screen.getByRole("combobox"), "f-1");
    expect(push).toHaveBeenCalledWith(`/dispatch/?date=${DATE}&flight=f-1`);
  });

  it("keeps the day when the selection is cleared", async () => {
    // Dropping the date here would bounce the dispatcher back to today
    // and lose the day they were working.
    push.mockReset();
    const user = userEvent.setup();
    panel({ selectedFlightId: "f-1" });
    await user.selectOptions(screen.getByRole("combobox"), "");
    expect(push).toHaveBeenCalledWith(`/dispatch/?date=${DATE}`);
  });

  it("shows the supplied selectedFlightId as the current value", () => {
    panel({
      flights: [baseFlight(), baseFlight({ id: "f-2", flight_number: "GV103" })],
      selectedFlightId: "f-2",
    });
    expect(screen.getByRole("combobox")).toHaveValue("f-2");
  });

  it("renders children below the dropdown (summary slot)", () => {
    panel({ children: <div data-testid="summary-slot">summary content</div> });
    expect(screen.getByTestId("summary-slot")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = panel();
    await expectNoA11yViolations(container);
  });
});

// ---- Choosing the day -------------------------------------------------------
//
// Client report, 9 September: "mostly unsuccessful in building flight,
// assigning flights to pilots". The packet listed only flights
// departing today and offered no way to change that, so a flight built
// for tomorrow could not be selected, crewed or released from here.
// Dispatch plans ahead, so the day has to be a control.

describe("the day control", () => {
  it("shows the day being worked", () => {
    panel();
    expect(screen.getByLabelText(/schedule date/i)).toHaveValue(DATE);
  });

  it("steps forward exactly one day", async () => {
    push.mockReset();
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole("button", { name: /next day/i }));
    expect(push).toHaveBeenCalledWith("/dispatch/?date=2026-06-01");
  });

  it("steps back exactly one day", async () => {
    push.mockReset();
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole("button", { name: /previous day/i }));
    expect(push).toHaveBeenCalledWith("/dispatch/?date=2026-05-30");
  });

  it("steps in UTC, not the viewer's zone", async () => {
    // The fleet board's arrows once skipped two days at a time west of
    // Greenwich because the date was parsed as local midnight and
    // shifted with setDate. Crossing a month boundary from a date that
    // is "yesterday" in US zones is where that shows.
    push.mockReset();
    const user = userEvent.setup();
    panel({ date: "2026-03-01" });
    await user.click(screen.getByRole("button", { name: /previous day/i }));
    expect(push).toHaveBeenCalledWith("/dispatch/?date=2026-02-28");
  });

  it("handles a leap day", async () => {
    push.mockReset();
    const user = userEvent.setup();
    panel({ date: "2028-02-28" });
    await user.click(screen.getByRole("button", { name: /next day/i }));
    expect(push).toHaveBeenCalledWith("/dispatch/?date=2028-02-29");
  });

  it("goes to a day picked straight from the field", () => {
    // fireEvent rather than userEvent.type: typing into a date input
    // under jsdom emits partial values and never commits a whole date.
    push.mockReset();
    panel();
    fireEvent.change(screen.getByLabelText(/schedule date/i), {
      target: { value: "2026-07-04" },
    });
    expect(push).toHaveBeenCalledWith("/dispatch/?date=2026-07-04");
  });

  it("ignores the field being cleared rather than jumping to an empty day", () => {
    // A cleared date input reads as "", and navigating to ?date= would
    // silently fall back to today, moving the dispatcher off the day
    // they were working without asking.
    push.mockReset();
    panel();
    fireEvent.change(screen.getByLabelText(/schedule date/i), {
      target: { value: "" },
    });
    expect(push).not.toHaveBeenCalled();
  });
});

describe("a day with no flights", () => {
  // This panel used to return null when the list was empty, so the
  // dispatcher got a packet with no flight selector and — once the day
  // became a control — nothing to change the day with either. The
  // emptier the day, the less there was to work with.

  it("still renders, so the day can be changed", () => {
    panel({ flights: [] });
    expect(screen.getByLabelText(/schedule date/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next day/i }),
    ).toBeInTheDocument();
  });

  it("names the day that is empty", () => {
    // "No flights" without the date reads as "the system has no
    // flights", which is a different and much more alarming claim.
    panel({ flights: [] });
    expect(screen.getByText(new RegExp(DATE))).toBeInTheDocument();
  });

  it("offers building one", () => {
    panel({ flights: [] });
    expect(
      screen.getByRole("link", { name: /build a flight/i }),
    ).toHaveAttribute("href", "/flight-following/new");
  });

  it("has no combobox to pick from", () => {
    panel({ flights: [] });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("has no a11y violations either", async () => {
    const { container } = panel({ flights: [] });
    await expectNoA11yViolations(container);
  });
});
