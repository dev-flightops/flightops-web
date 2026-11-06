import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, signOffSquawk, inspectSquawk, rejectSquawkSignOff, deferSquawk, revalidatePath } = vi.hoisted(() => {
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
    signOffSquawk: vi.fn(),
    inspectSquawk: vi.fn(),
    rejectSquawkSignOff: vi.fn(),
    deferSquawk: vi.fn(),
    revalidatePath: vi.fn(),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ signOffSquawk, inspectSquawk, rejectSquawkSignOff, deferSquawk }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { deferAction, inspectAction, rejectAction, signOffAction } from "./actions";

const signOff = { work_notes: "Done", amt_name: "Mo", cert_number: "1", cert_type: "ap", airworthy: true, is_rii: false } as const;

beforeEach(() => {
  for (const fn of [signOffSquawk, inspectSquawk, rejectSquawkSignOff, deferSquawk, revalidatePath]) fn.mockReset();
});

describe("signing (#172)", () => {
  it("refreshes what the sign-off changes", async () => {
    signOffSquawk.mockResolvedValue({});
    expect(await signOffAction("s-1", "ac-1", signOff)).toEqual({ ok: true });
    expect(signOffSquawk).toHaveBeenCalledWith("s-1", signOff);
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(expect.arrayContaining(["/maintenance/rts", "/maintenance", "/maintenance/squawks", "/maintenance/aircraft/ac-1", "/maintenance/availability"]));
  });

  it.each([
    [{ work_notes: "  " }, "Describe the work"],
    [{ amt_name: "" }, "AMT's name"],
    [{ cert_number: " " }, "certificate number"],
    [{ cert_type: "" }, "certificate type"],
    [{ airworthy: false }, "Tick the certification"],
  ])("refuses a form missing %j", async (over, message) => {
    const result = await signOffAction("s-1", "ac-1", { ...signOff, ...over } as never);
    expect(result).toEqual({ ok: false, message: expect.stringContaining(message) });
    expect(signOffSquawk).not.toHaveBeenCalled();
  });

  it("carries the server's refusal back, in its words", async () => {
    inspectSquawk.mockRejectedValue(
      new TestApiError(409, "/rts", JSON.stringify({ detail: "You signed this work off, so someone else has to inspect it (14 CFR 135.429)." })),
    );
    const result = await inspectAction("s-1", "ac-1", { inspector_name: "Mo", cert_number: "1", notes: "", confirmed: true });
    expect(result).toEqual({ ok: false, message: expect.stringContaining("someone else has to inspect it") });
  });

  it("names who can when refused", async () => {
    signOffSquawk.mockRejectedValue(new TestApiError(403, "/rts", "no"));
    const result = await signOffAction("s-1", "ac-1", signOff);
    expect(result).toEqual({ ok: false, message: expect.stringContaining("Only maintenance") });
  });
});

describe("rejecting (#172)", () => {
  it("needs a reason", async () => {
    expect(await rejectAction("s-1", "ac-1", "  ")).toEqual({ ok: false, message: "Say why it's being rejected." });
    expect(rejectSquawkSignOff).not.toHaveBeenCalled();
  });
});

describe("deferring (#172)", () => {
  const base = { reason: "Why", mel_category: "C", ata_chapter: "24", reference: "", due_on: "" } as const;

  it("sends a DMI nothing an MEL needs", async () => {
    deferSquawk.mockResolvedValue({});
    await deferAction("s-1", "ac-1", { ...base, defer_type: "dmi", due_on: "2026-12-01" });
    expect(deferSquawk).toHaveBeenCalledWith("s-1", {
      defer_type: "dmi",
      reason: "Why",
      mel_category: null,
      ata_chapter: null,
      reference: null,
      due_on: "2026-12-01",
    });
  });

  it("sends an MEL its category and chapter", async () => {
    deferSquawk.mockResolvedValue({});
    await deferAction("s-1", "ac-1", { ...base, defer_type: "mel" });
    expect(deferSquawk).toHaveBeenCalledWith("s-1", expect.objectContaining({ defer_type: "mel", mel_category: "C", ata_chapter: "24", due_on: null }));
  });

  it("needs a reason", async () => {
    const result = await deferAction("s-1", "ac-1", { ...base, defer_type: "mel", reason: " " });
    expect(result).toEqual({ ok: false, message: "Give the reason for the deferral." });
  });
});
