import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScheduleRoute } from "@/lib/api/master-schedule";
import type { AircraftListItem } from "@/lib/api/types";

const { formState } = vi.hoisted(() => ({ formState: { current: null as unknown } }));
vi.mock("../actions", () => ({ saveRouteAction: vi.fn() }));
// Next runs the form on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [formState.current ?? initial, () => {}, false],
}));

import { RouteForm } from "./route-form";

const AIRCRAFT = [
  { id: "a-1", tail_number: "N100PA", model: "Cessna 208", is_active: true, cruise_speed_kt: 145 },
  { id: "a-2", tail_number: "N200PA", model: "Beech 1900", is_active: true, cruise_speed_kt: null },
] as unknown as AircraftListItem[];

const ZONES = { byIcao: {}, fallback: "America/Anchorage" };

function form(route: ScheduleRoute | undefined, onDone: () => void) {
  return (
    <RouteForm templateId="t-1" route={route} aircraft={AIRCRAFT} zones={ZONES} groundMinutes={15} onDone={onDone} />
  );
}

function open(route?: ScheduleRoute, onDone = vi.fn()) {
  render(form(route, onDone));
  return onDone;
}

const type = (label: string | RegExp, value: string, nth = 0) =>
  fireEvent.change(screen.getAllByLabelText(label)[nth], { target: { value } });

const leg = (n: number) => within(screen.getByRole("group", { name: `Leg ${n}` }));

beforeEach(() => {
  vi.clearAllMocks();
  formState.current = null;
});

describe("building a flight", () => {
  it("is a round trip by default: the way home is added once there is somewhere to come back from", () => {
    open();
    expect(screen.queryByRole("group", { name: "Leg 2" })).toBeNull();
    type("From", "panc");
    type("To", "pabe");
    expect(leg(2).getByLabelText("To")).toHaveProperty("value", "PANC");
  });

  it("the way home follows the origin, and unticking takes it off", () => {
    open();
    type("From", "PANC");
    type("To", "PABE");
    type("From", "PAKN");
    expect(leg(2).getByLabelText("To")).toHaveProperty("value", "PAKN");
    fireEvent.click(screen.getByLabelText("Round trip"));
    expect(screen.queryByRole("group", { name: "Leg 2" })).toBeNull();
  });

  it("sending the way home elsewhere stops it being one", () => {
    open();
    type("From", "PANC");
    type("To", "PABE");
    fireEvent.change(leg(2).getByLabelText("To"), { target: { value: "PAKN" } });
    expect(screen.getByLabelText("Round trip")).toHaveProperty("checked", false);
    expect(leg(2).getByLabelText("To")).toHaveProperty("value", "PAKN");
  });

  it("a stop goes before the way home", () => {
    open();
    type("From", "PANC");
    type("To", "PABE");
    fireEvent.click(screen.getByRole("button", { name: "+ Add stop" }));
    expect(leg(2).getByLabelText("To")).toHaveProperty("value", "");
    expect(leg(3).getByLabelText("To")).toHaveProperty("value", "PANC");
  });

  it("fills the times from the aircraft's cruise speed", () => {
    open();
    fireEvent.change(screen.getByLabelText("Aircraft"), { target: { value: "a-1" } });
    type("From", "PANC");
    type("To", "PABE");
    fireEvent.change(leg(1).getByLabelText("Departs"), { target: { value: "09:00" } });
    const arrives = (leg(1).getByLabelText("Arrives") as HTMLInputElement).value;
    expect(arrives).toMatch(/^\d\d:\d\d$/);
    expect(arrives > "09:00").toBe(true);
    // Back after the ground time at the stop.
    const back = (leg(2).getByLabelText("Departs") as HTMLInputElement).value;
    const [h, m] = arrives.split(":").map(Number);
    const after = h * 60 + m + 15;
    expect(back).toBe(`${String(Math.floor(after / 60)).padStart(2, "0")}:${String(after % 60).padStart(2, "0")}`);
  });

  it("never overwrites a time typed by hand", () => {
    open();
    fireEvent.change(screen.getByLabelText("Aircraft"), { target: { value: "a-1" } });
    type("From", "PANC");
    type("To", "PABE");
    fireEvent.change(leg(1).getByLabelText("Departs"), { target: { value: "09:00" } });
    fireEvent.change(leg(1).getByLabelText("Arrives"), { target: { value: "11:11" } });
    fireEvent.change(leg(1).getByLabelText("Departs"), { target: { value: "09:30" } });
    expect(leg(1).getByLabelText("Arrives")).toHaveProperty("value", "11:11");
  });

  it("says when the aircraft has no cruise speed", () => {
    open();
    fireEvent.change(screen.getByLabelText("Aircraft"), { target: { value: "a-2" } });
    expect(screen.getByText(/N200PA has no cruise speed, so type the times/)).toBeTruthy();
  });

  it("operates every day until told otherwise", () => {
    open();
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByLabelText(day)).toHaveProperty("checked", true);
    }
    fireEvent.click(screen.getByLabelText("Sun"));
    expect(screen.getByLabelText("Sun")).toHaveProperty("checked", false);
  });
});

describe("changing a flight", () => {
  const ROUTE: ScheduleRoute = {
    id: "r-1",
    flight_number: "GV101",
    aircraft: { id: "a-1", tail_number: "N100PA", model: "Cessna 208", is_active: true },
    legs: [
      { origin: "PANC", destination: "PABE", departs: "09:00", arrives: "10:17" },
      { origin: "PABE", destination: "PANC", departs: "11:00", arrives: "12:13" },
    ],
    days_of_week: [0, 1, 2, 3, 4],
    is_ifr: true,
    notes: "Morning",
  };

  it("opens with what it has, and fills in nothing over it", () => {
    open(ROUTE);
    expect(screen.getByLabelText("Flight number")).toHaveProperty("value", "GV101");
    expect(screen.getByLabelText("Aircraft")).toHaveProperty("value", "a-1");
    expect(screen.getByLabelText("Round trip")).toHaveProperty("checked", true);
    expect(screen.getByLabelText("Flown IFR")).toHaveProperty("checked", true);
    expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Morning");
    expect(leg(1).getByLabelText("Arrives")).toHaveProperty("value", "10:17");
    expect(leg(2).getByLabelText("Departs")).toHaveProperty("value", "11:00");
    expect(leg(2).getByLabelText("Arrives")).toHaveProperty("value", "12:13");
    expect(screen.getByLabelText("Sun")).toHaveProperty("checked", false);
    expect(screen.getAllByRole("group", { name: /^Leg/ })).toHaveLength(2);
  });

  it("still shows an aircraft retired since", () => {
    open({ ...ROUTE, aircraft: { id: "a-9", tail_number: "N999PA", model: "Old", is_active: false } });
    expect(screen.getByLabelText("Aircraft")).toHaveProperty("value", "a-9");
    expect(screen.getByRole("option", { name: "N999PA — not active" })).toBeTruthy();
  });

  it("closes on a save and stays open on a refusal, with what was typed", () => {
    formState.current = { status: "error", message: "That aircraft isn't active.", attempt: 1 };
    const onDone = vi.fn();
    const { rerender } = render(form(ROUTE, onDone));
    expect(screen.getByRole("alert")).toHaveProperty("textContent", "That aircraft isn't active.");
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Flight number")).toHaveProperty("value", "GV101");
    expect(leg(2).getByLabelText("Arrives")).toHaveProperty("value", "12:13");

    formState.current = { status: "ok", attempt: 2 };
    rerender(form(ROUTE, onDone));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
