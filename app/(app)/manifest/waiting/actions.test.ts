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
  return { TestApiError, createWaiting: vi.fn(), cancelWaiting: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: api.TestApiError }));
vi.mock("@/lib/api/manifest", () => ({ createWaiting: api.createWaiting, cancelWaiting: api.cancelWaiting }));
vi.mock("next/cache", () => ({ revalidatePath: api.revalidatePath }));

import { cancelWaitingAction, createWaitingAction } from "./actions";

const IDLE = { status: "idle" as const, attempt: 0 };
const ENTRY = "0d5e3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const entry = (over: Record<string, string> = {}) =>
  form({
    station_icao: " pabe ",
    destination_icao: "pahp",
    kind: "bypass_mail",
    description: "",
    weight_lbs: "2,000",
    pieces: "40",
    shipper: "",
    consignee: "",
    notes: "",
    ...over,
  });

beforeEach(() => {
  api.createWaiting.mockReset().mockResolvedValue({});
  api.cancelWaiting.mockReset().mockResolvedValue({});
  api.revalidatePath.mockReset();
});

describe("createWaitingAction (#75)", () => {
  it("logs mail with the codes upper-cased and the weight as a number", async () => {
    const state = await createWaitingAction(IDLE, entry());
    expect(api.createWaiting).toHaveBeenCalledWith({
      station_icao: "PABE",
      destination_icao: "PAHP",
      mail_class: "bypass_mail",
      description: null,
      weight_lbs: "2000",
      pieces: 40,
      shipper: null,
      consignee: null,
      notes: null,
    });
    expect(state).toEqual({
      status: "ok",
      message: "Logged 2,000 lb at PABE for PAHP.",
      values: { station_icao: "PABE", destination_icao: "PAHP", kind: "bypass_mail" },
      attempt: 1,
    });
    expect(api.revalidatePath).toHaveBeenCalledWith("/manifest/waiting");
  });

  it("logs cargo as cargo, one piece when pieces is left empty", async () => {
    await createWaitingAction(IDLE, entry({ kind: "cargo", description: "Generator", weight_lbs: "300", pieces: "" }));
    expect(api.createWaiting).toHaveBeenCalledWith(
      expect.objectContaining({ mail_class: null, description: "Generator", weight_lbs: "300", pieces: 1 }),
    );
  });

  it.each([
    ["cargo with no description", { kind: "cargo" }, "Describe the cargo."],
    ["a destination that is the station", { destination_icao: "PABE" }, "The destination is the station it's waiting at."],
    ["a bad airport code", { station_icao: "P-B" }, "Enter the station as a 3- or 4-letter airport code."],
    ["no weight", { weight_lbs: "0" }, "Enter the weight in pounds."],
    ["a weight in words", { weight_lbs: "heavy" }, "Enter the weight in pounds."],
    ["half a piece", { pieces: "1.5" }, "Pieces is a whole number, 1 or more."],
  ])("refuses %s before it reaches the API", async (_label, over, message) => {
    const state = await createWaitingAction(IDLE, entry(over));
    expect(api.createWaiting).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "error", message });
    expect(state.values?.weight_lbs).toBe((over as Record<string, string>).weight_lbs ?? "2,000");
  });

  it("explains the API's refusals", async () => {
    api.createWaiting.mockRejectedValue(new api.TestApiError(403, "/manifest/waiting", "forbidden"));
    expect((await createWaitingAction(IDLE, entry())).message).toBe("Your account can't log waiting mail or freight.");
    api.createWaiting.mockRejectedValue(new api.TestApiError(422, "/manifest/waiting", '{"detail":"describe_the_cargo"}'));
    expect((await createWaitingAction(IDLE, entry())).message).toBe("Describe the cargo.");
  });
});

describe("cancelWaitingAction (#75)", () => {
  it("takes the entry off the list", async () => {
    expect(await cancelWaitingAction(IDLE, form({ id: ENTRY }))).toEqual({ status: "ok", attempt: 1 });
    expect(api.cancelWaiting).toHaveBeenCalledWith(ENTRY);
    expect(api.revalidatePath).toHaveBeenCalledWith("/manifest/waiting");
  });

  it("says so when it was loaded meanwhile", async () => {
    api.cancelWaiting.mockRejectedValue(new api.TestApiError(409, "/manifest/waiting", '{"detail":"waiting_load_is_loaded"}'));
    expect((await cancelWaitingAction(IDLE, form({ id: ENTRY }))).message).toBe(
      "That entry is no longer waiting. Refresh the page.",
    );
  });
});
