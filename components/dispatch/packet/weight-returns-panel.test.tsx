import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeightReturn } from "@/lib/api/types";

import { WeightReturnsPanel } from "./weight-returns-panel";

/**
 * The client, 29 Oct: "There's no simple way to get back in on the manifest
 * and bump pax or weight" (#153). Bob Henderson returned MM1122 at 955 lb.
 */
function returned(over: Partial<WeightReturn> = {}): WeightReturn {
  return {
    id: "r-1",
    flight_id: "9c0d43c4-73ef-4881-8f4d-f8b8447ec06c",
    pilot_user_id: "p-1",
    pilot_name: "Bob Henderson",
    max_payload_lbs: "955.0",
    note: null,
    created_at: "2026-10-30T00:41:14Z",
    resolved_at: null,
    resolved_by_user_id: null,
    is_open: true,
    flight_number: "MM1122",
    payload_lbs: "1216.0",
    ...over,
  };
}

describe("a flight returned over weight (#153)", () => {
  it("names the flight, says how much to take off and opens its manifest", () => {
    render(<WeightReturnsPanel returns={[returned()]} />);
    expect(screen.getByRole("link", { name: "MM1122 · Bob Henderson" })).toBeInTheDocument();
    expect(screen.getByText("Payload now 1,216 lb: take off 261 lb.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open manifest ›" })).toHaveAttribute(
      "href",
      "/manifest/9c0d43c4-73ef-4881-8f4d-f8b8447ec06c",
    );
  });

  it("says when the payload is within the pilot's figure, or there's no manifest", () => {
    const { rerender } = render(<WeightReturnsPanel returns={[returned({ payload_lbs: "900.0" })]} />);
    expect(screen.getByText("Payload now 900 lb, within the pilot's figure.")).toBeInTheDocument();
    rerender(<WeightReturnsPanel returns={[returned({ payload_lbs: null })]} />);
    expect(screen.getByText("No manifest yet.")).toBeInTheDocument();
  });
});
