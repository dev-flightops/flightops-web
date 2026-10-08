import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NotamAcknowledgmentPanel } from "./notam-acknowledgment-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

/** A round trip names its home airport twice (#57). */

describe("NotamAcknowledgmentPanel on a round trip", () => {
  it("asks once per airport and counts airports, not stops", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<NotamAcknowledgmentPanel icaos={["PANC", "PABE", "PANC"]} ackedFromUrl={["PABE"]} />);
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual([
      "Acknowledge NOTAMs for PANC",
      "Acknowledge NOTAMs for PABE",
    ]);
    expect(screen.getByText("1/2 acknowledged")).toBeTruthy();
    // No "two children with the same key".
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("is done once both airports are acknowledged", () => {
    render(<NotamAcknowledgmentPanel icaos={["PANC", "PABE", "PANC"]} ackedFromUrl={["PANC", "PABE"]} />);
    expect(screen.getByText("2/2 acknowledged")).toBeTruthy();
  });
});
