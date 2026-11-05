import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { formState } = vi.hoisted(() => ({ formState: { current: null as unknown } }));
vi.mock("../actions", () => ({ publishAction: vi.fn() }));
// Next runs the form on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [formState.current ?? initial, () => {}, false],
}));

import { PublishForm } from "./publish-form";

const VALUES = { name: "Winter", start_date: "2026-11-09", end_date: "2026-11-13" };
const PREVIEW = {
  preview: true,
  flights: 5,
  by_flight: [{ flight_number: "GV101", count: 5 }],
  first_date: "2026-11-09",
  last_date: "2026-11-13",
  already_there: 2,
  problem_count: 3,
  problems: [
    { date: "2026-11-10", flight_number: "GV102", code: "aircraft_busy", message: "N100PA is on CH900 at that time." },
  ],
  publication_id: null,
};

/** The form with these dates in it, as the action answered `state`. */
function open(state: unknown = null) {
  formState.current = state;
  render(<PublishForm templateId="t-1" defaultName="Winter" defaultStart="2026-11-09" />);
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-11-13" } });
}

beforeEach(() => {
  formState.current = null;
});

describe("PublishForm", () => {
  it("offers only Preview to begin with", () => {
    open();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
  });

  it("says what the dates would do, and Publish names how many", () => {
    open({ status: "preview", result: PREVIEW, values: VALUES, attempt: 1 });
    expect(screen.getByText(/Adds 5 flights, Nov 9, 2026 to Nov 13, 2026: GV101 × 5\./)).toBeTruthy();
    expect(screen.getByText(/2 flights already there stay as they are/)).toBeTruthy();
    expect(screen.getByText(/N100PA is on CH900 at that time\./)).toBeTruthy();
    expect(screen.getByText("and 2 more")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish 5 flights" })).toBeTruthy();
  });

  it("asks for the preview again once a date changes", () => {
    open({ status: "preview", result: PREVIEW, values: VALUES, attempt: 1 });
    expect(screen.getByRole("button", { name: "Publish 5 flights" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-11-20" } });
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
    expect(screen.queryByText(/Adds 5 flights/)).toBeNull();
  });

  it("offers nothing to publish when there is nothing to add", () => {
    open({
      status: "preview",
      result: { ...PREVIEW, flights: 0, by_flight: [], first_date: null, last_date: null, problem_count: 0, problems: [] },
      values: VALUES,
      attempt: 1,
    });
    expect(screen.getByText(/Nothing to add\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
  });

  it("says what was added and links the Schedule on its first day", () => {
    open({
      status: "published",
      result: { ...PREVIEW, preview: false, publication_id: "p-1" },
      values: VALUES,
      attempt: 2,
    });
    expect(screen.getByText(/5 flights added\./)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open the Schedule/ }).getAttribute("href")).toBe("/schedule?date=2026-11-09");
    expect(screen.queryByRole("button", { name: /^Publish/ })).toBeNull();
  });

  it("shows a refusal", () => {
    open({ status: "error", message: "The start date can't be before today.", values: VALUES, attempt: 1 });
    expect(screen.getByRole("alert").textContent).toBe("The start date can't be before today.");
  });
});
