import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPartExpiration } = vi.hoisted(() => ({ getPartExpiration: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/maintenance", () => ({ getPartExpiration }));

import ExpirationPage from "./page";

const row = (id: string, day: string) => ({
  id,
  part_number: id,
  description: `Part ${id}`,
  batch_number: "B1",
  lot_number: null,
  expiration_date: day,
  qty_on_hand: 2,
  location: "Bin 1",
});

const none = { today: "2026-11-06", expired: [], within_30: [], within_60: [], within_90: [] };

beforeEach(() => {
  getPartExpiration.mockReset();
});

describe("Parts Expiration Report (#172)", () => {
  it("shows the four figures and each band's parts", async () => {
    getPartExpiration.mockResolvedValue({
      ...none,
      expired: [row("OLD", "2026-10-01")],
      within_30: [row("A", "2026-11-20"), row("B", "2026-11-21")],
      within_90: [row("C", "2027-01-20")],
    });
    render(await ExpirationPage());
    const figures = screen.getByRole("group", { name: "Parts by when they expire" });
    expect(figures).toHaveTextContent("1Expired");
    expect(figures).toHaveTextContent("2Next 30 Days");
    expect(figures).toHaveTextContent("031-60 Days");
    expect(figures).toHaveTextContent("161-90 Days");
    const expired = screen.getByRole("region", { name: "Expired: Do Not Install" });
    expect(within(expired).getByRole("link", { name: "OLD" })).toHaveAttribute("href", "/maintenance/inventory/OLD");
    expect(within(expired).getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Expiring 31-60 Days" })).not.toBeInTheDocument();
    expect(screen.getByText(/within 90 days of Nov 6, 2026/)).toBeInTheDocument();
  });

  it("says when nothing is coming up", async () => {
    getPartExpiration.mockResolvedValue(none);
    render(await ExpirationPage());
    expect(screen.getByText("No parts with expiration dates in the next 90 days.")).toBeInTheDocument();
  });

  it("says so when it can't load", async () => {
    getPartExpiration.mockRejectedValue(new Error("boom"));
    render(await ExpirationPage());
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  });
});
