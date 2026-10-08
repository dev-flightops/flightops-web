import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, fileSafetyReport, redirectSpy } = vi.hoisted(() => {
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
    fileSafetyReport: vi.fn(),
    redirectSpy: vi.fn((_url: string) => {
      const err = new Error("NEXT_REDIRECT");
      (err as Error & { __redirect?: true }).__redirect = true;
      throw err;
    }),
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/safety-reports", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/safety-reports")>()),
  fileSafetyReport,
}));
vi.mock("next/navigation", () => ({ redirect: redirectSpy }));

import { fileSafetyReportAction, type FileReportState } from "./actions";

const idle: FileReportState = { status: "idle", attempt: 0 };

function form(fields: Record<string, string> = {}, attachment?: File): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    report_type: "near_miss",
    title: "Fuel truck inside the wing line",
    description: "Stopped two feet off the left wingtip at PABE.",
    occurred_on: "2026-10-07",
    location: "PABE ramp",
    flight_number: "",
    aircraft_tail: "n208pf",
    reporter_department: "Ground Ops",
    severity: "4",
    likelihood: "3",
    ...fields,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  if (attachment) fd.set("attachment", attachment);
  return fd;
}

async function submit(fd: FormData, prev: FileReportState = idle) {
  try {
    return await fileSafetyReportAction(prev, fd);
  } catch (err) {
    if ((err as { __redirect?: true }).__redirect) return "redirected" as const;
    throw err;
  }
}

beforeEach(() => {
  fileSafetyReport.mockReset();
  redirectSpy.mockClear();
});

describe("filing a safety report", () => {
  it("files it and opens the new report", async () => {
    fileSafetyReport.mockResolvedValueOnce({ id: "r-1" });
    expect(await submit(form())).toBe("redirected");

    const [filing, file] = fileSafetyReport.mock.calls[0];
    expect(filing).toEqual({
      report_type: "near_miss",
      title: "Fuel truck inside the wing line",
      description: "Stopped two feet off the left wingtip at PABE.",
      location: "PABE ramp",
      flight_number: null,
      aircraft_tail: "n208pf",
      occurred_on: "2026-10-07",
      is_anonymous: false,
      reporter_department: "Ground Ops",
      severity: 4,
      likelihood: 3,
    });
    expect(file).toBeNull();
    expect(redirectSpy).toHaveBeenCalledWith("/safety/reports/r-1?filed=1");
  });

  it("carries the page the red button was pressed on", async () => {
    fileSafetyReport.mockResolvedValueOnce({ id: "r-1" });
    await submit(form({ return_url: "/dispatch/board?day=today" }));
    expect(redirectSpy).toHaveBeenCalledWith(
      "/safety/reports/r-1?filed=1&return_url=%2Fdispatch%2Fboard%3Fday%3Dtoday",
    );
  });

  it("drops a return_url that leaves the app", async () => {
    fileSafetyReport.mockResolvedValueOnce({ id: "r-1" });
    await submit(form({ return_url: "//evil.test/x" }));
    expect(redirectSpy).toHaveBeenCalledWith("/safety/reports/r-1?filed=1");
  });

  it("sends no department on an anonymous report", async () => {
    fileSafetyReport.mockResolvedValueOnce({ id: "r-1" });
    await submit(form({ is_anonymous: "on" }));
    expect(fileSafetyReport.mock.calls[0][0]).toMatchObject({
      is_anonymous: true,
      reporter_department: null,
    });
  });

  it("leaves severity and likelihood unset when not given", async () => {
    fileSafetyReport.mockResolvedValueOnce({ id: "r-1" });
    await submit(form({ severity: "", likelihood: "" }));
    expect(fileSafetyReport.mock.calls[0][0]).toMatchObject({ severity: null, likelihood: null });
  });

  it("passes the attachment on", async () => {
    fileSafetyReport.mockResolvedValueOnce({ id: "r-1" });
    const photo = new File(["jpeg"], "ramp.jpg", { type: "image/jpeg" });
    await submit(form({}, photo));
    expect((fileSafetyReport.mock.calls[0][1] as File).name).toBe("ramp.jpg");
  });

  it("refuses a missing title, keeping everything typed for the form", async () => {
    const state = await submit(form({ title: "  " }), { status: "error", attempt: 2 });
    expect(fileSafetyReport).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      status: "error",
      attempt: 3,
      fieldErrors: { title: "Give the report a title." },
    });
    expect(state !== "redirected" && state.values?.description).toBe(
      "Stopped two feet off the left wingtip at PABE.",
    );
  });

  it("refuses a risk value off the 1-5 scale", async () => {
    const state = await submit(form({ severity: "9" }));
    expect(state).toMatchObject({ status: "error", fieldErrors: { severity: expect.any(String) } });
  });

  it("refuses an attachment too big for the app to carry", async () => {
    const big = new File([new Uint8Array(3_900_000)], "scan.pdf", { type: "application/pdf" });
    const state = await submit(form({}, big));
    expect(fileSafetyReport).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "error" });
    expect(state !== "redirected" && state.message).toMatch(/over 3\.8 MB.*Pick the attachment again\./);
  });

  it("explains a file the service will not take", async () => {
    fileSafetyReport.mockRejectedValueOnce(new TestApiError(415, "/safety/reports", "attachment_must_be_photo_or_pdf"));
    const photo = new File(["heic"], "IMG_0001.HEIC", { type: "image/heic" });
    const state = await submit(form({}, photo));
    expect(state !== "redirected" && state.message).toMatch(/HEIC photo has to be exported as JPEG/);
  });

  it("says when the service could not be reached", async () => {
    fileSafetyReport.mockRejectedValueOnce(new Error("fetch failed"));
    const state = await submit(form());
    expect(state).toMatchObject({ status: "error", message: expect.stringMatching(/Could not reach/) });
  });
});
