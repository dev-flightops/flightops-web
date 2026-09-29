import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComplianceFinding } from "@/lib/api/types";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
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
 * gone. Each panel rebuilt the URL from the one last rendered.
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

describe("ticks in different panels before the page comes back", () => {
  it("keeps the SIC acknowledgment when a NOTAM box is ticked next", () => {
    render(
      <>
        <SoftWarningAckList seat="sic" findings={[sicLanding]} ackedCodes={new Set()} />
        <NotamAcknowledgmentPanel icaos={["PABE", "PASM"]} ackedFromUrl={[]} />
      </>,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Acknowledge SIC Day Landing Currency" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Acknowledge NOTAMs for PABE" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Acknowledge NOTAMs for PASM" }));

    const url = new URLSearchParams(lastUrl().split("?")[1]);
    expect(url.get("warns_acked")).toBe("sic:sic_day_landing_currency");
    expect(url.get("notams_acked")).toBe("PABE,PASM");
  });

  it("keeps the PIC's acknowledgment when the SIC's is ticked next", () => {
    // Two lists, one per seat. Each only waits on its own ticks.
    const picIfr: ComplianceFinding = {
      ...sicLanding,
      currency_item_id: "i-pic",
      code: "ifr_currency",
      name: "IFR Currency",
      regulation: "14 CFR 61.57(c)",
    };
    render(
      <>
        <SoftWarningAckList seat="pic" findings={[picIfr]} ackedCodes={new Set()} />
        <SoftWarningAckList seat="sic" findings={[sicLanding]} ackedCodes={new Set()} />
      </>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Acknowledge IFR Currency" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Acknowledge SIC Day Landing Currency" }),
    );

    const url = new URLSearchParams(lastUrl().split("?")[1]);
    expect(url.get("warns_acked")).toBe("ifr_currency,sic:sic_day_landing_currency");
  });

  it("keeps a NOTAM acknowledgment and each MEL ticked after it", () => {
    render(
      <>
        <NotamAcknowledgmentPanel icaos={["PABE"]} ackedFromUrl={[]} />
        <MelAckList
          items={[
            {
              id: "mel-1",
              aircraft: { id: "a-1", tail_number: "N503PA", model: "C208B" },
              ata_chapter: "33",
              description: "Left nav light inoperative",
              category: "C",
              deferred_at: "2026-09-27T10:00:00Z",
              due_at: "2026-10-27T10:00:00Z",
              status: "open",
              closed_at: null,
              closed_by: null,
              notes: null,
            },
            {
              id: "mel-2",
              aircraft: { id: "a-1", tail_number: "N503PA", model: "C208B" },
              ata_chapter: "34",
              description: "Autopilot inoperative",
              category: "C",
              deferred_at: "2026-09-27T10:00:00Z",
              due_at: "2026-10-27T10:00:00Z",
              status: "open",
              closed_at: null,
              closed_by: null,
              notes: null,
            },
          ]}
          ackedMelIds={[]}
        />
      </>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Acknowledge NOTAMs for PABE" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Acknowledge MEL 34 — Autopilot inoperative" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Acknowledge MEL 33 — Left nav light inoperative",
      }),
    );

    const url = new URLSearchParams(lastUrl().split("?")[1]);
    expect(url.get("notams_acked")).toBe("PABE");
    expect(url.get("mels_acked")).toBe("mel-1,mel-2");
  });
});
