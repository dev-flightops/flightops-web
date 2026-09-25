import { describe, expect, it } from "vitest";

import { departmentForPath } from "./modules";

describe("departmentForPath", () => {
  it("files a page under the department whose prefix it sits in", () => {
    expect(departmentForPath("/dispatch/abc")?.id).toBe("operations");
    expect(departmentForPath("/academy/assignments")?.id).toBe("academy");
    expect(departmentForPath("/ai/query")?.id).toBe("admin");
  });

  it("matches whole segments, so a longer route name is not captured", () => {
    // "/fuel" is Ground Ops; the supplier portal is not.
    expect(departmentForPath("/fuel/orders")?.id).toBe("ground-ops");
    expect(departmentForPath("/fuel-supplier")).toBeNull();
  });

  it("prefers the most specific prefix, whatever the declaration order", () => {
    expect(departmentForPath("/reservations/sim-export")?.id).toBe("admin");
    expect(departmentForPath("/reservations/bookings")?.id).toBe("reservations");
  });

  it("belongs nowhere at the root", () => {
    expect(departmentForPath("/")).toBeNull();
    expect(departmentForPath("/home")).toBeNull();
  });
});
