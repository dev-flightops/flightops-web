import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { markReplannedAction, refresh } = vi.hoisted(() => ({
  markReplannedAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/(app)/dispatch/[flightId]/actions", () => ({ markReplannedAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

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

describe("marking it re-planned (#174)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markReplannedAction.mockResolvedValue({ ok: true });
  });

  it("clears it at once when the load is within the pilot's figure", async () => {
    const user = userEvent.setup();
    render(<WeightReturnsPanel returns={[returned({ payload_lbs: "884.0" })]} canResolve />);
    await user.click(screen.getByRole("button", { name: "Mark Re-planned" }));
    expect(markReplannedAction).toHaveBeenCalledWith("9c0d43c4-73ef-4881-8f4d-f8b8447ec06c");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("asks once when it's still over: the figure was for that aircraft", async () => {
    const user = userEvent.setup();
    render(<WeightReturnsPanel returns={[returned()]} canResolve />);
    await user.click(screen.getByRole("button", { name: "Mark Re-planned" }));
    expect(markReplannedAction).not.toHaveBeenCalled();
    expect(screen.getByText(/still 261 lb over the pilot's figure/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark Re-planned Anyway" }));
    expect(markReplannedAction).toHaveBeenCalledTimes(1);
  });

  it("can be backed out of", async () => {
    const user = userEvent.setup();
    render(<WeightReturnsPanel returns={[returned()]} canResolve />);
    await user.click(screen.getByRole("button", { name: "Mark Re-planned" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(markReplannedAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Mark Re-planned" })).toBeInTheDocument();
  });

  it("says why when it's refused", async () => {
    markReplannedAction.mockResolvedValue({ ok: false, error: "Save failed (HTTP 500)." });
    const user = userEvent.setup();
    render(<WeightReturnsPanel returns={[returned({ payload_lbs: "900.0" })]} canResolve />);
    await user.click(screen.getByRole("button", { name: "Mark Re-planned" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed (HTTP 500).");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("isn't offered to someone who can't", () => {
    render(<WeightReturnsPanel returns={[returned()]} />);
    expect(screen.queryByRole("button", { name: "Mark Re-planned" })).toBeNull();
  });
});
