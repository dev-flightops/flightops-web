import { describe, expect, it } from "vitest";

import { defaultReturnTime } from "./return-default";

/**
 * The client, 10/30: "Trying to book a round trip for marcus chen. Received
 * this error": "Backend rejected the booking (HTTP 422)". Both ways started
 * at 09:00 on the same day, and the way back must leave after the way out.
 */
describe("the way back's time before anyone picks one (#174)", () => {
  it("is after the way out on the same day", () => {
    expect(defaultReturnTime("2026-10-30", "2026-10-30T09:00")).toBe("2026-10-30T11:00");
    expect(defaultReturnTime("2026-10-30", "2026-10-30T14:30")).toBe("2026-10-30T16:30");
  });

  it("stays on the day late in the evening", () => {
    expect(defaultReturnTime("2026-10-30", "2026-10-30T23:00")).toBe("2026-10-30T23:59");
  });

  it("is 09:00 on a later day, or with no way out to go by", () => {
    expect(defaultReturnTime("2026-10-31", "2026-10-30T14:30")).toBe("2026-10-31T09:00");
    expect(defaultReturnTime("2026-10-31", null)).toBe("2026-10-31T09:00");
    expect(defaultReturnTime("2026-10-31", "2026-10-31")).toBe("2026-10-31T09:00");
  });
});
