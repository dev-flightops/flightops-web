import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComplianceFinding } from "@/lib/api/types";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const save = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
vi.mock("@/app/(app)/dispatch/ack-actions", () => ({
  saveAcknowledgmentsAction: (...args: unknown[]) => save(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  // The page never comes back in these tests: every tick is made
  // while the URL still shows the flight alone.
  useSearchParams: () => new URLSearchParams("flight=f1"),
  usePathname: () => "/dispatch/",
}));

import { nextDispatchQuery, settleDispatchQuery } from "./dispatch-query";
import { MelAckList } from "./mel-ack-list";
import { NotamAcknowledgmentPanel } from "./notam-acknowledgment-panel";
import { SoftWarningAckList } from "./soft-warning-ack-list";

/**
 * Walking the 27 Sep fixes on 28 Sep: tick the SIC's soft warning, tick
 * a NOTAM box before the page came back, and the SIC acknowledgment was
 * gone. Each panel rebuilt the URL from the one last rendered. Since #155
 * the ticks are saved per dispatcher and never go in the URL at all, so
 * panels can't take each other's away; the URL keeps the rest of the
 * packet's state (the flight, the PIC, the route).
 */

const sicLanding: ComplianceFinding = {
  currency_item_id: "i-sic",
  code: "sic_day_landing_currency",
  name: "SIC Day Landing Currency",
  regulation: "14 CFR 61.57(a)",
  status: "not_started",
  last_completed_date: null,
  grace_month_end: null,
  message: "1 of 3 required in last 90 days.",
};

const lastUrl = () =>
  [...push.mock.calls, ...replace.mock.calls]
    .map((c) => c[0] as string)
    .sort((a, b) => a.length - b.length)
    .at(-1) ?? "";

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  save.mockClear();
});

describe("nextDispatchQuery", () => {
  it("builds a change on one the page is still loading", () => {
    nextDispatchQuery("flight=f1", (p) => p.set("warns_acked", "ipc"));
    expect(
      nextDispatchQuery("flight=f1", (p) => p.set("notams_acked", "PABE")),
    ).toBe("flight=f1&warns_acked=ipc&notams_acked=PABE");
  });

  it("keeps building on it while the page shows a step on the way", () => {
    const first = nextDispatchQuery("flight=f1", (p) => p.set("warns_acked", "ipc"));
    nextDispatchQuery("flight=f1", (p) => p.set("notams_acked", "PABE"));
    // The first navigation has rendered; the second has not.
    expect(
      nextDispatchQuery(first, (p) => p.set("stale_wx_ack", "1")),
    ).toBe("flight=f1&warns_acked=ipc&notams_acked=PABE&stale_wx_ack=1");
  });

  it("starts from what the page shows after a different flight is picked", () => {
    nextDispatchQuery("flight=f1", (p) => p.set("warns_acked", "ipc"));
    expect(
      nextDispatchQuery("flight=f2", (p) => p.set("notams_acked", "PAHP")),
    ).toBe("flight=f2&notams_acked=PAHP");
  });

  it("does not bring back a tick the back button went past", () => {
    const acked = nextDispatchQuery("flight=f1", (p) => p.set("warns_acked", "ipc"));
    settleDispatchQuery(acked);
    // Back to before the tick, then a NOTAM box.
    expect(
      nextDispatchQuery("flight=f1", (p) => p.set("notams_acked", "PABE")),
    ).toBe("flight=f1&notams_acked=PABE");
  });
});

describe("ticks in different panels (#155: saved, never in the URL)", () => {
  const melItem = (id: string, ata: string, description: string) => ({
    id,
    aircraft: { id: "a-1", tail_number: "N503PA", model: "C208B" },
    ata_chapter: ata,
    description,
    category: "C" as const,
    deferred_at: "2026-09-27T10:00:00Z",
    due_at: "2026-10-27T10:00:00Z",
    status: "open" as const,
    closed_at: null,
    closed_by: null,
    notes: null,
  });

  it("each panel saves its own ticks, and none of them touches the URL", async () => {
    render(
      <>
        <SoftWarningAckList flightId="f1" seat="sic" findings={[sicLanding]} ackedCodes={new Set()} />
        <NotamAcknowledgmentPanel flightId="f1" icaos={["PABE", "PASM"]} acked={[]} />
        <MelAckList
          flightId="f1"
          items={[melItem("mel-1", "33", "Left nav light inoperative")]}
          ackedMelIds={[]}
        />
      </>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Acknowledge SIC Day Landing Currency" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Acknowledge NOTAMs for PABE" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Acknowledge NOTAMs for PASM" }));
    fireEvent.click(screen.getByLabelText(/Acknowledge MEL 33/));

    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    const saved = save.mock.calls.flatMap((c) => c[1] as { kind: string; key: string }[]);
    expect(saved.map((c) => `${c.kind}:${c.key}`).sort()).toEqual([
      "mel:mel-1",
      "notam:PABE",
      "notam:PASM",
      "soft_warning:sic:sic_day_landing_currency",
    ]);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
