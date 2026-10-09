import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => {
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
    addPax: vi.fn(),
    updatePax: vi.fn(),
    deletePax: vi.fn(),
    addCargo: vi.fn(),
    updateCargo: vi.fn(),
    deleteCargo: vi.fn(),
    createManifest: vi.fn(),
    lockManifest: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: api.TestApiError }));
vi.mock("@/lib/api/manifest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/manifest")>()),
  addPax: api.addPax,
  updatePax: api.updatePax,
  deletePax: api.deletePax,
  addCargo: api.addCargo,
  updateCargo: api.updateCargo,
  deleteCargo: api.deleteCargo,
  createManifest: api.createManifest,
  lockManifest: api.lockManifest,
}));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));

import {
  createManifestAction,
  lockManifestAction,
  removeLineAction,
  saveFreightAction,
  savePaxAction,
} from "./actions";

const FLIGHT = "6b0f6a3e-2c1d-4e5f-8a9b-0c1d2e3f4a5b";
const PAX = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const LINE = "1f2e3d4c-5b6a-4978-8a6b-5c4d3e2f1a0b";
const IDLE = { status: "idle" as const, attempt: 0 };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const pax = (over: Record<string, string> = {}) =>
  form({
    flight_id: FLIGHT,
    pax_id: "",
    first_name: " Ann ",
    last_name: "Quill",
    weight_lbs: "152",
    baggage_lbs: "",
    seat_number: "1a",
    ticket_type: "revenue",
    contact_phone: "",
    contact_email: "",
    notes: "",
    ...over,
  });

beforeEach(() => {
  for (const fn of Object.values(api)) if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
});

describe("passengers (#62)", () => {
  it("adds one, blanks as nulls and no baggage as 0, and refreshes the page", async () => {
    api.addPax.mockResolvedValueOnce({});
    const state = await savePaxAction(IDLE, pax({ is_crew: "on" }));
    expect(api.addPax).toHaveBeenCalledWith(FLIGHT, {
      first_name: "Ann",
      last_name: "Quill",
      weight_lbs: "152",
      baggage_lbs: "0",
      seat_number: "1A",
      ticket_type: "revenue",
      is_crew: true,
      is_unaccompanied_minor: false,
      contact_phone: null,
      contact_email: null,
      notes: null,
    });
    expect(state).toEqual({ status: "ok", message: "Added Ann Quill.", attempt: 1 });
    expect(api.revalidatePath).toHaveBeenCalledWith(`/manifest/${FLIGHT}`);
  });

  it("saves an edit whole, so an emptied field is cleared", async () => {
    api.updatePax.mockResolvedValueOnce({});
    const state = await savePaxAction(IDLE, pax({ pax_id: PAX, seat_number: "", contact_email: "ann@example.test" }));
    expect(api.addPax).not.toHaveBeenCalled();
    expect(api.updatePax).toHaveBeenCalledWith(
      PAX,
      expect.objectContaining({ seat_number: null, contact_email: "ann@example.test", is_crew: false }),
    );
    expect(state.message).toBe("Saved Ann Quill.");
  });

  it.each([
    [{ weight_lbs: "" }, "Enter the passenger's weight."],
    [{ weight_lbs: "-5" }, "Enter the passenger's weight in pounds."],
    [{ weight_lbs: "12000" }, "The passenger's weight can't be over 9,999 lb."],
    [{ last_name: "  " }, "Enter the last name."],
    [{ contact_email: "not-an-email" }, "Enter a valid email, or leave it blank."],
  ])("refuses %o without calling the API, and keeps what was typed", async (bad, message) => {
    const state = await savePaxAction(IDLE, pax(bad));
    expect(state).toMatchObject({ status: "error", message, attempt: 1 });
    expect(state.values?.first_name).toBe(" Ann ");
    expect(api.addPax).not.toHaveBeenCalled();
  });

  it("says the manifest is locked when it was locked meanwhile", async () => {
    api.addPax.mockRejectedValueOnce(new api.TestApiError(409, "/x", "locked"));
    const state = await savePaxAction(IDLE, pax());
    expect(state).toMatchObject({ status: "error", message: "This manifest is locked, so it can't be changed." });
    expect(api.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("mail and cargo (#62)", () => {
  const mail = (over: Record<string, string> = {}) =>
    form({ flight_id: FLIGHT, kind: "mail", cargo_id: "", mail_class: "bypass_mail", weight_lbs: "40.5", pieces: "", notes: "Pouch 12", ...over });
  const cargo = (over: Record<string, string> = {}) =>
    form({
      flight_id: FLIGHT,
      kind: "cargo",
      cargo_id: "",
      description: "UPS package",
      weight_lbs: "15.5",
      pieces: "2",
      tracking_number: "1Z999",
      shipper: "",
      consignee: "Clinic",
      hazmat_notes: "Class 9",
      notes: "",
      ...over,
    });

  it("adds mail as a cargo line with its class, described as legacy names it", async () => {
    api.addCargo.mockResolvedValueOnce({});
    const state = await saveFreightAction(IDLE, mail());
    expect(api.addCargo).toHaveBeenCalledWith(FLIGHT, {
      description: "USPS Bypass Mail",
      weight_lbs: "40.5",
      pieces: 1,
      mail_class: "bypass_mail",
      is_hazmat: false,
      hazmat_notes: null,
      shipper: null,
      consignee: null,
      tracking_number: null,
      notes: "Pouch 12",
    });
    expect(state).toEqual({ status: "ok", message: "Added mail.", attempt: 1 });
  });

  it("re-derives a mail line's description when its class changes, but keeps one somebody wrote", async () => {
    api.updateCargo.mockResolvedValue({});
    await saveFreightAction(
      IDLE,
      mail({ cargo_id: LINE, mail_class: "priority_mail", current_description: "USPS Bypass Mail", current_mail_class: "bypass_mail" }),
    );
    expect(api.updateCargo).toHaveBeenLastCalledWith(LINE, {
      description: "USPS Priority Mail",
      weight_lbs: "40.5",
      pieces: 1,
      mail_class: "priority_mail",
      notes: "Pouch 12",
    });
    await saveFreightAction(
      IDLE,
      mail({ cargo_id: LINE, mail_class: "priority_mail", current_description: "USPS mail — Anchorage sort", current_mail_class: "bypass_mail" }),
    );
    expect(api.updateCargo).toHaveBeenLastCalledWith(LINE, expect.objectContaining({ description: "USPS mail — Anchorage sort" }));
  });

  it("keeps hazmat notes only on hazardous cargo", async () => {
    api.addCargo.mockResolvedValue({});
    await saveFreightAction(IDLE, cargo());
    expect(api.addCargo).toHaveBeenLastCalledWith(
      FLIGHT,
      expect.objectContaining({ is_hazmat: false, hazmat_notes: null, pieces: 2, tracking_number: "1Z999", shipper: null }),
    );
    await saveFreightAction(IDLE, cargo({ is_hazmat: "on" }));
    expect(api.addCargo).toHaveBeenLastCalledWith(FLIGHT, expect.objectContaining({ is_hazmat: true, hazmat_notes: "Class 9" }));
  });

  it.each([
    [{ description: "" }, "Describe the cargo."],
    [{ pieces: "0" }, "Pieces is a whole number, 1 or more."],
    [{ pieces: "1.5" }, "Pieces is a whole number, 1 or more."],
  ])("refuses cargo with %o", async (bad, message) => {
    const state = await saveFreightAction(IDLE, cargo(bad));
    expect(state).toMatchObject({ status: "error", message });
    expect(api.addCargo).not.toHaveBeenCalled();
  });

  it("refuses an unknown mail class", async () => {
    const state = await saveFreightAction(IDLE, mail({ mail_class: "parcel_post" }));
    expect(state).toMatchObject({ status: "error", message: "Pick the mail class." });
  });
});

describe("removing, creating and locking (#62)", () => {
  it("removes a passenger or a line by kind", async () => {
    api.deletePax.mockResolvedValueOnce(undefined);
    api.deleteCargo.mockResolvedValueOnce(undefined);
    expect(await removeLineAction(IDLE, form({ flight_id: FLIGHT, kind: "pax", line_id: PAX }))).toEqual({ status: "ok", attempt: 1 });
    expect(await removeLineAction(IDLE, form({ flight_id: FLIGHT, kind: "cargo", line_id: LINE }))).toEqual({ status: "ok", attempt: 1 });
    expect(api.deletePax).toHaveBeenCalledWith(PAX);
    expect(api.deleteCargo).toHaveBeenCalledWith(LINE);
  });

  it("shows the manifest somebody else just created rather than an error", async () => {
    api.createManifest.mockRejectedValueOnce(new api.TestApiError(409, "/x", "exists"));
    expect(await createManifestAction(IDLE, form({ flight_id: FLIGHT }))).toEqual({ status: "ok", attempt: 1 });
    expect(api.revalidatePath).toHaveBeenCalledWith(`/manifest/${FLIGHT}`);
  });

  it("names who may lock when the API refuses", async () => {
    api.lockManifest.mockRejectedValueOnce(new api.TestApiError(403, "/x", "forbidden"));
    const state = await lockManifestAction(IDLE, form({ flight_id: FLIGHT }));
    expect(state.status).toBe("error");
    expect(state.message).toContain("Ground Ops, Reservations Agents, Dispatchers");
    expect(api.revalidatePath).not.toHaveBeenCalled();
  });

  it("locks and refreshes the page", async () => {
    api.lockManifest.mockResolvedValueOnce({});
    expect(await lockManifestAction(IDLE, form({ flight_id: FLIGHT }))).toEqual({ status: "ok", attempt: 1 });
    expect(api.lockManifest).toHaveBeenCalledWith(FLIGHT);
  });
});
