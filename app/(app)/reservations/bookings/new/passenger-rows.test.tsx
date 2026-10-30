import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PassengerRows } from "./passenger-rows";

/**
 * The client, 29 Oct: "it would be better for the reservations folks to see
 * max payload instead of overloading the plane and waiting for the pilot to
 * kick the weight back" (#153). Greg: show it and warn; it still files.
 */
describe("a party heavier than the flight can still carry (#153)", () => {
  it("warns once the weights entered pass what is left, and not before", () => {
    render(
      <PassengerRows initialCount={2} customerName="Rita Return" payloadLeft={[{ flightNumber: "PGR791", lbs: 300 }]} />,
    );
    fireEvent.change(screen.getByLabelText("Passenger 1 weight (lb)"), { target: { value: "190" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Passenger 2 weight (lb)"), { target: { value: "150" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The weights entered come to 340 lb, more than the 300 lb PGR791 can still carry. It still files; the gate check-in won't board it over weight.",
    );
  });

  it("says when the flight is full by weight already", () => {
    render(
      <PassengerRows initialCount={1} customerName="Rita Return" payloadLeft={[{ flightNumber: "MM1122", lbs: -261 }]} />,
    );
    fireEvent.change(screen.getByLabelText("Passenger 1 weight (lb)"), { target: { value: "180" } });
    expect(screen.getByRole("alert")).toHaveTextContent("MM1122 can't carry more: it's at or over its useful load already.");
  });
});
