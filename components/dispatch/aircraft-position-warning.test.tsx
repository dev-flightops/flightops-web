import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { AircraftPositionWarning } from "./aircraft-position-warning";

afterEach(cleanup);

it("says where the aircraft will be, both ways (1124-05)", () => {
  // N503PA lands at Kipnuk at 10:35 AKST; the next flight leaves Anchorage.
  render(
    <AircraftPositionWarning
      tail="N503PA"
      origin="PANC"
      destination="PAEN"
      conflicts={[
        { kind: "arrives_elsewhere", flight_id: "f-1", flight_number: "TCL3", airport: "PAKI", at: "2026-11-25T19:35:00Z" },
        { kind: "next_leaves_elsewhere", flight_id: "f-3", flight_number: "TCL5", airport: "PABE", at: "2026-11-25T22:00:00Z" },
      ]}
    />,
  );
  const alert = screen.getByRole("alert", { name: "Aircraft position" });
  expect(alert).toHaveTextContent(
    "N503PA lands at PAKI on Nov 25 at 10:35 AKST on TCL3, not at PANC, where this flight leaves from.",
  );
  expect(alert).toHaveTextContent("N503PA's next flight, TCL5, leaves PABE on Nov 25 at 13:00 AKST, not PAEN, where this one lands.");
});

it("says nothing when the aircraft follows its flights", () => {
  const { container } = render(
    <AircraftPositionWarning tail="N503PA" origin="PANC" destination="PAEN" conflicts={[]} />,
  );
  expect(container).toBeEmptyDOMElement();
});
