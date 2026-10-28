import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CharterRow } from "@/lib/api/charter";

const { auth, listCharters, listCustomers } = vi.hoisted(() => ({
  auth: vi.fn(),
  listCharters: vi.fn(),
  listCustomers: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/charter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/charter")>()),
  listCharters,
}));
vi.mock("@/lib/api/reservations", () => ({ listCustomers }));
vi.mock("./new-charter-toggle", () => ({ NewCharterToggle: () => null }));
vi.mock("./transition-buttons", () => ({ TransitionButtons: () => null }));

import CharterPipelinePage from "./page";

function charter(overrides: Partial<CharterRow>): CharterRow {
  return {
    id: "9868a454-cfa1-46ca-8c26-ed2de62953ee",
    customer_id: "c-1",
    customer_name: "Alice Northrup",
    origin_icao: "PABE",
    destination_icao: "PAII",
    requested_date: "2026-10-25",
    requested_time: "10:30",
    return_date: null,
    return_time: null,
    pax_count: 5,
    cargo_lbs: "0",
    aircraft_type_requested: null,
    special_requirements: null,
    status: "confirmed",
    flight_id: null,
    quoted_total_cents: null,
    notes: null,
    ...overrides,
  };
}

async function renderPage() {
  render(await CharterPipelinePage({ searchParams: Promise.resolve({}) }));
}

beforeEach(() => {
  listCustomers.mockResolvedValue({ items: [] });
});

describe("the charter pipeline's flights (#133)", () => {
  it("offers to build a confirmed charter's flight, and opens one it has", async () => {
    // The client, 25 Oct: "the charter pipeline doesn't appear to flow
    // into the flights?"
    auth.mockResolvedValue({ roles: ["dispatcher"] });
    listCharters.mockResolvedValue({
      items: [
        charter({}),
        charter({ id: "b9e804a7-776b-468f-9bcb-1623d4939f52", status: "quoted" }),
        charter({ id: "f9e2f37a-7d50-4723-b3df-c7310ac483f6", flight_id: "fl-1" }),
      ],
    });
    await renderPage();
    expect(screen.getByRole("link", { name: /Build flight/ })).toHaveAttribute(
      "href",
      "/flight-following/new?charter=9868a454-cfa1-46ca-8c26-ed2de62953ee",
    );
    expect(screen.getAllByRole("link", { name: /Build flight/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /^Flight/ })).toHaveAttribute(
      "href",
      "/dispatch?flight=fl-1",
    );
  });

  it("leaves building the flight to those who open flights", async () => {
    auth.mockResolvedValue({ roles: ["reservations_agent"] });
    listCharters.mockResolvedValue({ items: [charter({})] });
    await renderPage();
    expect(screen.queryByRole("link", { name: /Build flight/ })).toBeNull();
  });
});
