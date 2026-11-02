import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  TestApiError,
  changeGseStatus,
  completeGseMaintenance,
  createGseMaintenance,
  createGseSquawk,
  deleteGseDocument,
  redirectSpy,
  resolveGseSquawk,
  updateGseUnit,
  uploadGseDocument,
} = vi.hoisted(() => {
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
    changeGseStatus: vi.fn(),
    completeGseMaintenance: vi.fn(),
    createGseMaintenance: vi.fn(),
    createGseSquawk: vi.fn(),
    deleteGseDocument: vi.fn(),
    redirectSpy: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
    resolveGseSquawk: vi.fn(),
    updateGseUnit: vi.fn(),
    uploadGseDocument: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({
  changeGseStatus,
  completeGseMaintenance,
  createGseMaintenance,
  createGseSquawk,
  deleteGseDocument,
  resolveGseSquawk,
  updateGseUnit,
  uploadGseDocument,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

import {
  removeEquipmentAction,
  restoreEquipmentAction,
  uploadGseDocumentAction,
  changeStatusAction,
  completeMaintenanceAction,
  reportSquawkAction,
  resolveSquawkAction,
  scheduleMaintenanceAction,
} from "./actions";

const UNIT = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const refused = () => new TestApiError(403, "/ground/gse", "insufficient_role");
const only = (what: string) => ({
  status: "api-error",
  message: `Only Ground Ops, the Director of Maintenance, the Director of Operations or an Exec Admin can ${what}.`,
});

beforeEach(() => {
  for (const fn of [
    changeGseStatus,
    completeGseMaintenance,
    createGseMaintenance,
    createGseSquawk,
    resolveGseSquawk,
  ]) {
    fn.mockReset().mockRejectedValue(refused());
  }
});

describe("equipment actions refused by role (29 Sep)", () => {
  it("status change says who can", async () => {
    expect(
      await changeStatusAction({ status: "idle" }, form({ unit_id: UNIT, status: "maintenance" })),
    ).toEqual(only("change equipment status"));
  });

  it("resolving a squawk says who can", async () => {
    expect(
      await resolveSquawkAction(
        { status: "idle" },
        form({ unit_id: UNIT, squawk_id: OTHER, resolution_notes: "Aired up" }),
      ),
    ).toEqual(only("resolve a squawk"));
  });

  it("scheduling maintenance says who can", async () => {
    expect(
      await scheduleMaintenanceAction(
        { status: "idle" },
        form({ unit_id: UNIT, title: "100hr", interval_hours: "100" }),
      ),
    ).toEqual(only("schedule equipment maintenance"));
  });

  it("completing maintenance says who can", async () => {
    expect(
      await completeMaintenanceAction(
        { status: "idle" },
        form({ unit_id: UNIT, mx_id: OTHER, completed_date: "2026-09-30" }),
      ),
    ).toEqual(only("complete equipment maintenance"));
  });

  it("reporting a squawk is open to all staff, so a 403 there claims no role", async () => {
    expect(
      await reportSquawkAction(
        { status: "idle" },
        form({ unit_id: UNIT, description: "Tire low", reported_date: "2026-09-30" }),
      ),
    ).toEqual({
      status: "api-error",
      message: "Action failed (HTTP 403). Try again in a moment.",
    });
  });
});

describe("removing and documents (#134)", () => {
  it("takes a unit off the list and goes back to it", async () => {
    updateGseUnit.mockResolvedValueOnce({});
    await expect(removeEquipmentAction("u-1")).rejects.toThrow("NEXT_REDIRECT");
    expect(updateGseUnit).toHaveBeenCalledWith("u-1", { is_active: false });
    expect(redirectSpy).toHaveBeenCalledWith("/equipment");
  });

  it("puts it back, and says who may when refused", async () => {
    updateGseUnit.mockResolvedValueOnce({});
    expect(await restoreEquipmentAction("u-1")).toEqual({ status: "ok" });
    expect(updateGseUnit).toHaveBeenLastCalledWith("u-1", { is_active: true });
    updateGseUnit.mockRejectedValueOnce(new TestApiError(403, "/ground/gse/u-1", "insufficient_role"));
    const refused = await restoreEquipmentAction("u-1");
    expect(refused).toEqual({
      status: "api-error",
      message:
        "Only Ground Ops, the Director of Maintenance, the Director of Operations or an Exec Admin can put equipment back on the list.",
    });
  });

  it("needs a file, and says when it's too big", async () => {
    const empty = new FormData();
    expect(await uploadGseDocumentAction("u-1", { status: "idle" }, empty)).toEqual({
      status: "field-errors",
      errors: { file: "Pick a file to upload." },
    });
    const form = new FormData();
    form.set("file", new File(["%PDF-"], "manual.pdf", { type: "application/pdf" }));
    uploadGseDocument.mockRejectedValueOnce(new TestApiError(413, "/ground/gse/u-1/documents", "document_exceeds_10mb"));
    const tooBig = await uploadGseDocumentAction("u-1", { status: "idle" }, form);
    expect(tooBig).toEqual({ status: "api-error", message: "Files over 3.8 MB can't be uploaded yet." });
    uploadGseDocument.mockResolvedValueOnce({ id: "g-1" });
    expect(await uploadGseDocumentAction("u-1", { status: "idle" }, form)).toEqual({ status: "ok" });
    expect(uploadGseDocument).toHaveBeenLastCalledWith("u-1", form);
  });
});

