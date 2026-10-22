import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, submitIncident, loadZoneTable } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    submitIncident: vi.fn(async () => ({ id: "inc-1" })),
    loadZoneTable: vi.fn(async () => ({
      byIcao: { PANC: "America/Anchorage", PADK: "America/Adak" },
      fallback: "America/Anchorage",
    })),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/safety", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/safety")>()),
  submitIncident,
}));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { submitIncidentAction } from "./actions";

/**
 * When an incident happened (#72).
 *
 * The time is typed in a datetime-local field, which carries no zone.
 * The action read it with `new Date()`, in the server's zone: UTC on
 * Vercel, so an incident at 14:30 in Alaska was saved as 14:30Z, eight
 * hours early. It is local to the station, or to the company's base
 * when there is none, as flight times are (#68).
 */

const STATION = "22222222-2222-4222-8222-222222222222";

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    category: "ground_ops",
    severity: "medium",
    occurred_at_local: "2026-10-21T14:30",
    description: "Tug clipped the wingtip while pushing back.",
    injury_summary: "none",
    damage_summary: "Scratched wingtip fairing.",
    ...over,
  };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function filed(fd: FormData) {
  await expect(submitIncidentAction({ status: "idle" }, fd)).rejects.toThrow(
    "REDIRECT:/safety/incidents/inc-1?filed=1",
  );
  return (submitIncident.mock.calls.at(-1) as unknown as [{ occurred_at: string }])[0];
}

describe("submitIncidentAction: the time it happened", () => {
  beforeEach(() => submitIncident.mockClear());

  it("reads a time with no station in the company's base zone", async () => {
    // 14:30 AKDT is 22:30Z, not 14:30Z.
    expect((await filed(form())).occurred_at).toBe("2026-10-21T22:30:00Z");
  });

  it("reads it in the station's zone when the station is a base with one", async () => {
    // Adak keeps Hawaii-Aleutian time: 14:30 HADT is 23:30Z.
    const sent = await filed(form({ station_id: STATION, station_icao: "PADK" }));
    expect(sent.occurred_at).toBe("2026-10-21T23:30:00Z");
  });

  it("uses the base zone for a station that is not a base", async () => {
    const sent = await filed(form({ station_id: STATION, station_icao: "PAOM" }));
    expect(sent.occurred_at).toBe("2026-10-21T22:30:00Z");
  });

  it("refuses a time it cannot read, and files nothing", async () => {
    const state = await submitIncidentAction(
      { status: "idle" },
      form({ occurred_at_local: "21/10/2026 14:30" }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.occurred_at_local).toBe("Please pick a valid date and time.");
    expect(submitIncident).not.toHaveBeenCalled();
  });
});
