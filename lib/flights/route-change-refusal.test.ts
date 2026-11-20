import { describe, expect, it } from "vitest";

import { namesList, routeChangeRefusal } from "./route-change-refusal";

// What an ApiError carries: the status and the reply's body.
const refused = (detail: unknown, status = 409) => ({ status, message: JSON.stringify({ detail }) });

describe("routeChangeRefusal (#208)", () => {
  it("names who is checked in for the stop, and the way out", () => {
    expect(
      routeChangeRefusal(
        refused({ error: "passengers_checked_in", stops: ["PAVA"], passengers: ["Ella Ramirez"] }),
      ),
    ).toBe(
      "Ella Ramirez is checked in for PAVA. Undo the check-in on the Check-in page first, then save the route.",
    );
    expect(
      routeChangeRefusal(
        refused({ error: "passengers_checked_in", stops: [], passengers: ["Ann Lee", "Bo Fox"] }),
      ),
    ).toBe("Ann Lee and Bo Fox are checked in. Undo the check-in on the Check-in page first, then save the route.");
  });

  it("names what would come off a locked manifest", () => {
    expect(
      routeChangeRefusal(
        refused({
          error: "manifest_locked",
          stops: ["PAVA"],
          passengers: ["Ella Ramirez"],
          lines: ["USPS Bypass Mail"],
        }),
      ),
    ).toBe(
      "The manifest is locked, and this route takes Ella Ramirez and USPS Bypass Mail off it (PAVA is no longer a stop). Reopen the manifest, then save the route.",
    );
    expect(
      routeChangeRefusal(refused({ error: "manifest_locked", stops: ["PAVA", "PACM"], passengers: [], lines: [] })),
    ).toBe(
      "The manifest is locked, and this route takes passengers or freight off it (PAVA and PACM are no longer stops). Reopen the manifest, then save the route.",
    );
  });

  it("leaves every other refusal to the rest", () => {
    expect(routeChangeRefusal(refused("flight_number_conflict"))).toBeNull();
    expect(routeChangeRefusal(refused({ error: "unknown_airport", codes: ["PXXX"] }, 422))).toBeNull();
    expect(routeChangeRefusal({ status: 409, message: "not json" })).toBeNull();
  });

  it("lists names the way a sentence does", () => {
    expect([namesList([]), namesList(["A"]), namesList(["A", "B"]), namesList(["A", "B", "C"])]).toEqual([
      "",
      "A",
      "A and B",
      "A, B and C",
    ]);
  });
});
