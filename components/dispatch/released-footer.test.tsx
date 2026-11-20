import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReleasedFooter, releasedAtText } from "./released-footer";
import type { UserRef } from "@/lib/api/types";

const user: UserRef = {
  id: "u-1",
  full_name: "Demo Admin",
  email: "admin@flightops.local",
};
const ALASKA = "America/Anchorage";

describe("ReleasedFooter", () => {
  it("renders 'Released' label and user name", () => {
    render(<ReleasedFooter releasedAt="2026-05-27T14:32:00Z" releasedBy={user} timeZone={ALASKA} />);
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByText("Demo Admin")).toBeInTheDocument();
  });

  it("renders a <time> element with the ISO timestamp", () => {
    const iso = "2026-05-27T14:32:00Z";
    const { container } = render(<ReleasedFooter releasedAt={iso} releasedBy={user} timeZone={ALASKA} />);
    const time = container.querySelector("time");
    expect(time).not.toBeNull();
    expect(time?.getAttribute("datetime")).toBe(iso);
  });

  it("uses data-testid for stable selection", () => {
    render(<ReleasedFooter releasedAt="2026-05-27T14:32:00Z" releasedBy={user} timeZone={ALASKA} />);
    expect(screen.getByTestId("released-footer")).toBeInTheDocument();
  });

  // 20 Nov: released at 01:04 AKST, the banner said "Nov 20, 2026, 10:04 AM",
  // the server's UTC with no zone.
  it("reads the release time on the departure base's clock, with the Zulu beside it", () => {
    render(<ReleasedFooter releasedAt="2026-11-20T10:04:00Z" releasedBy={user} timeZone={ALASKA} />);
    expect(screen.getByText("Nov 20, 2026, 01:04 AKST (10:04Z)")).toBeInTheDocument();
  });

  it("keeps the local calendar day across UTC midnight, and summer time", () => {
    expect(releasedAtText("2026-11-21T02:30:00Z", ALASKA)).toBe("Nov 20, 2026, 17:30 AKST (02:30Z)");
    expect(releasedAtText("2026-07-01T19:00:00Z", ALASKA)).toBe("Jul 1, 2026, 11:00 AKDT (19:00Z)");
  });
});
