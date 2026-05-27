import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReleasedFooter } from "./released-footer";
import type { UserRef } from "@/lib/api/types";

const user: UserRef = {
  id: "u-1",
  full_name: "Demo Admin",
  email: "admin@flightops.local",
};

describe("ReleasedFooter", () => {
  it("renders 'Released' label and user name", () => {
    render(<ReleasedFooter releasedAt="2026-05-27T14:32:00Z" releasedBy={user} />);
    expect(screen.getByText("Released")).toBeInTheDocument();
    expect(screen.getByText("Demo Admin")).toBeInTheDocument();
  });

  it("renders a <time> element with the ISO timestamp", () => {
    const iso = "2026-05-27T14:32:00Z";
    const { container } = render(<ReleasedFooter releasedAt={iso} releasedBy={user} />);
    const time = container.querySelector("time");
    expect(time).not.toBeNull();
    expect(time?.getAttribute("datetime")).toBe(iso);
  });

  it("uses data-testid for stable selection", () => {
    render(<ReleasedFooter releasedAt="2026-05-27T14:32:00Z" releasedBy={user} />);
    expect(screen.getByTestId("released-footer")).toBeInTheDocument();
  });
});
