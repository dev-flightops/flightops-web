import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, api, redirect, revalidatePath } = vi.hoisted(() => {
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
    api: {
      startInspection: vi.fn(),
      updateInspection: vi.fn(),
      cancelInspection: vi.fn(),
      addInspectionItem: vi.fn(),
      removeInspectionItem: vi.fn(),
      passInspectionItem: vi.fn(),
      failInspectionItem: vi.fn(),
      signOffInspection: vi.fn(),
    },
    redirect: vi.fn((to: string) => {
      throw new Error(`REDIRECT ${to}`);
    }),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/inspections", () => api);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { failItemAction, signOffAction, startInspectionAction } from "./actions";

const AIRCRAFT = "0b6c6b1e-2d4c-4c4e-9a8f-1f2e3d4c5b6a";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const sign = {
  signed_off_on: "2026-11-09",
  signer_name: " Pat Mechanic ",
  cert_number: "3456789",
  cert_type: "ia" as const,
  total_time_hours: "4210.4",
  notes: "",
  due_item_id: "",
};

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  revalidatePath.mockReset();
});

describe("starting an inspection (#178)", () => {
  it("needs the aircraft and a title", async () => {
    const state = await startInspectionAction({ status: "idle" }, form({ inspection_type: "annual", title: " " }));
    expect(state).toEqual({
      status: "field-errors",
      errors: { title: "Give the inspection a title.", aircraft_id: "Pick the aircraft." },
    });
    expect(api.startInspection).not.toHaveBeenCalled();
  });

  it("starts it and opens it", async () => {
    api.startInspection.mockResolvedValue({ id: "i-1" });
    await expect(
      startInspectionAction(
        { status: "idle" },
        form({ aircraft_id: AIRCRAFT, inspection_type: "100hr", title: "100-hour", target_on: "", assigned_to_user_id: "" }),
      ),
    ).rejects.toThrow("REDIRECT /maintenance/inspections/i-1");
    expect(api.startInspection).toHaveBeenCalledWith(
      expect.objectContaining({ aircraft_id: AIRCRAFT, title: "100-hour", target_on: null, assigned_to_user_id: null, work_order_id: null }),
    );
  });
});

describe("failing an item (#178)", () => {
  it("needs what was found, which becomes the squawk", async () => {
    const result = await failItemAction("i-1", "it-1", { finding: "  ", severity: "major" });
    expect(result).toEqual({ ok: false, message: "Say what was found: it becomes the squawk." });
    expect(api.failInspectionItem).not.toHaveBeenCalled();
  });

  it("opens the squawk and refreshes the squawk list", async () => {
    api.failInspectionItem.mockResolvedValue({});
    const result = await failItemAction("i-1", "it-1", { finding: "Worn", severity: "grounding" });
    expect(result).toEqual({ ok: true });
    expect(api.failInspectionItem).toHaveBeenCalledWith("i-1", "it-1", { finding: "Worn", severity: "grounding" });
    expect(revalidatePath).toHaveBeenCalledWith("/maintenance/squawks");
  });
});

describe("the sign-off (#178)", () => {
  it("sends the certificate, total time and due-list item", async () => {
    api.signOffInspection.mockResolvedValue({});
    const due = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    expect(await signOffAction("i-1", { ...sign, due_item_id: due })).toEqual({ ok: true });
    expect(api.signOffInspection).toHaveBeenCalledWith("i-1", {
      signed_off_on: "2026-11-09",
      signer_name: "Pat Mechanic",
      cert_number: "3456789",
      cert_type: "ia",
      total_time_hours: 4210.4,
      notes: null,
      due_item_id: due,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/maintenance/due-list");
  });

  it("needs the certificate number, and hours as a number", async () => {
    expect(await signOffAction("i-1", { ...sign, cert_number: " " })).toEqual({
      ok: false,
      message: "Give the certificate number.",
    });
    expect(await signOffAction("i-1", { ...sign, total_time_hours: "lots" })).toEqual({
      ok: false,
      message: "Give the total time in hours.",
    });
    expect(api.signOffInspection).not.toHaveBeenCalled();
  });

  it("names the roles that may sign, and passes the service's refusal on", async () => {
    api.signOffInspection.mockRejectedValueOnce(new TestApiError(403, "/x", "no"));
    expect(await signOffAction("i-1", sign)).toEqual({
      ok: false,
      message: "Only maintenance, the Director of Maintenance or an Exec Admin can sign an inspection off.",
    });
    api.signOffInspection.mockRejectedValueOnce(
      new TestApiError(409, "/x", JSON.stringify({ detail: "1 discrepancy still open: resolve its squawk first." })),
    );
    expect(await signOffAction("i-1", sign)).toEqual({
      ok: false,
      message: "1 discrepancy still open: resolve its squawk first.",
    });
  });
});
