import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import type { SubmittedStop } from "./actions";
import { StopsEditor } from "./stops-editor";

function Harness({
  initial = [],
  errors = {},
}: {
  initial?: SubmittedStop[];
  errors?: Record<string, string>;
}) {
  const [stops, setStops] = useState(initial);
  return (
    <form aria-label="route">
      <StopsEditor stops={stops} onChange={setStops} firstDestination="PAHP" errors={errors} />
    </form>
  );
}

describe("StopsEditor", () => {
  it("adds a leg that departs where the leg before it landed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "+ Add stop" }));
    expect(screen.getByRole("group", { name: "Leg 2" })).toHaveTextContent("Leg 2 · from PAHP");
    await user.type(screen.getByLabelText(/Destination ICAO/), "pasm");
    expect(screen.getByLabelText(/Destination ICAO/)).toHaveValue("PASM");
    await user.click(screen.getByRole("button", { name: "+ Add stop" }));
    expect(screen.getByRole("group", { name: "Leg 3" })).toHaveTextContent("Leg 3 · from PASM");
  });

  it("removes a leg", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { destination: "PASM", departure: "", arrival: "" },
          { destination: "PAKN", departure: "", arrival: "" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove leg 2" }));
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByRole("group", { name: "Leg 2" })).toHaveTextContent("from PAHP");
    expect(screen.getByDisplayValue("PAKN")).toBeInTheDocument();
  });

  it("shows a stop's error against its field", () => {
    render(
      <Harness
        initial={[{ destination: "PASM", departure: "2026-07-01T14:30", arrival: "" }]}
        errors={{ stop_0_departure: "Departs before the leg before it lands" }}
      />,
    );
    expect(screen.getByLabelText(/ETD/)).toHaveAccessibleDescription(
      "Departs before the leg before it lands",
    );
  });

  it("has no a11y violations with a stop added", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "+ Add stop" }));
    await expectNoA11yViolations(container);
  });
});
