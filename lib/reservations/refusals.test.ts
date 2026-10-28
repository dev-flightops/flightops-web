import { describe, expect, it } from "vitest";

import { refusalMessage } from "./refusals";

describe("a refused booking or manifest change, in words (#137)", () => {
  it("says how many seats a full flight has left", () => {
    expect(
      refusalMessage('{"detail":{"error":"flight_full","seats_available":0,"seats_requested":3}}'),
    ).toBe("That flight has 0 seats left on the legs this booking rides; it needs 3.");
  });

  it("names a final manifest and a booked passenger", () => {
    expect(refusalMessage('{"detail":{"error":"manifest_locked","flight_id":"f"}}')).toBe(
      "That flight's manifest is final, so its passengers can't change.",
    );
    expect(refusalMessage('{"detail":{"error":"on_booking","booking_id":"b"}}')).toMatch(/on a booking/);
  });

  it("keeps the detail of anything it doesn't know", () => {
    expect(refusalMessage("something_new")).toBe("The change was refused (something_new).");
  });
});
