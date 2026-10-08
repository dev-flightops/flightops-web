import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "./client";
import {
  fileSafetyReport,
  listSafetyReports,
  reviewSafetyReport,
  riskOf,
  safetyReportAttachmentHref,
} from "./safety-reports";

const mockedApiFetch = vi.mocked(apiFetch);

beforeEach(() => mockedApiFetch.mockReset());

describe("riskOf", () => {
  // The service's banding, which the risk column and alerts rely on.
  it.each([
    [5, 3, 15, "high"],
    [4, 4, 16, "high"],
    [2, 4, 8, "medium"],
    [2, 3, 6, "low"],
    [1, 1, 1, "low"],
  ])("%i x %i is %i, %s", (severity, likelihood, score, level) => {
    expect(riskOf(severity, likelihood)).toEqual({ score, level });
  });

  it("has no score until both are set", () => {
    expect(riskOf(4, null)).toBeNull();
    expect(riskOf(undefined, 3)).toBeNull();
  });
});

describe("safety report client", () => {
  const filing = {
    report_type: "near_miss" as const,
    title: "Fuel truck inside the wing line",
    description: "Stopped two feet off the left wingtip.",
    is_anonymous: false,
  };

  it("files the fields as a JSON payload and the attachment beside it", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "r-1" });
    const photo = new File(["jpeg-bytes"], "ramp.jpg", { type: "image/jpeg" });
    await fileSafetyReport(filing, photo);

    const [path, init] = mockedApiFetch.mock.calls[0];
    expect(path).toBe("/safety/reports");
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect(JSON.parse(String(body.get("payload")))).toEqual(filing);
    expect((body.get("attachment") as File).name).toBe("ramp.jpg");
  });

  it("sends no attachment part when nothing was picked", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "r-1" });
    await fileSafetyReport(filing, new File([], ""));
    const body = mockedApiFetch.mock.calls[0][1]?.body as FormData;
    expect(body.has("attachment")).toBe(false);
  });

  it("passes the inbox filters as the service names them", async () => {
    mockedApiFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await listSafetyReports({ status: "open", type: "asap", limit: 50 });
    expect(mockedApiFetch).toHaveBeenCalledWith("/safety/reports?status=open&type=asap&limit=50");
  });

  it("reviews with a PATCH of only the fields given", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "r-1" });
    await reviewSafetyReport("r-1", { status: "closed", resolution: "Stand markings repainted." });
    const [path, init] = mockedApiFetch.mock.calls[0];
    expect(path).toBe("/safety/reports/r-1");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ status: "closed", resolution: "Stand markings repainted." });
  });

  it("opens attachments through the app's own route", () => {
    expect(safetyReportAttachmentHref("r-1")).toBe("/api/safety-reports/r-1/attachment");
  });
});
