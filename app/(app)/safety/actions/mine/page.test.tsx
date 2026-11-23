import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CorrectiveAction } from "@/lib/api/safety";

const { listMyCapas } = vi.hoisted(() => ({ listMyCapas: vi.fn() }));
vi.mock("@/lib/api/safety", async (actual) => ({
  ...(await actual<typeof import("@/lib/api/safety")>()),
  listMyCapas,
}));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: vi.fn(async () => ({ fallback: "America/Anchorage" })) }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import MyCapasPage from "./page";

function capa(over: Partial<CorrectiveAction> = {}): CorrectiveAction {
  const person = { id: "u-1", full_name: "Dana Whitfield", email: "dana@example.test" };
  return {
    id: "c-1",
    source_type: "safety_report",
    source_id: "r-1",
    title: "Clear the snow berm",
    description: "Push the berm back from the ramp edge.",
    owner: person,
    due_date: "2026-11-23",
    status: "open",
    notes: "",
    opened_by: person,
    closed_at: null,
    closed_by: null,
    closed_reason: null,
    created_at: "2026-11-23T20:00:00Z",
    updated_at: "2026-11-23T20:00:00Z",
    ...over,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("My CAPAs", () => {
  it("doesn't call one due today overdue once UTC's day has moved on (1119-25)", async () => {
    // 17:00 AKST on Nov 23 is 02:00Z on Nov 24.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T02:00:00Z"));
    listMyCapas.mockResolvedValueOnce({ items: [capa()], total: 1 });
    render(await MyCapasPage());
    expect(screen.getByText("Clear the snow berm")).toBeInTheDocument();
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });

  it("calls one overdue the day after it fell due", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T20:00:00Z"));
    listMyCapas.mockResolvedValueOnce({ items: [capa()], total: 1 });
    render(await MyCapasPage());
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });
});
