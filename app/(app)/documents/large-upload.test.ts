import { beforeEach, describe, expect, it, vi } from "vitest";

const { startLargeUploadAction, completeLargeUploadAction, putToStorage } = vi.hoisted(() => ({
  startLargeUploadAction: vi.fn(),
  completeLargeUploadAction: vi.fn(),
  putToStorage: vi.fn(),
}));
vi.mock("./actions", () => ({ startLargeUploadAction, completeLargeUploadAction }));
vi.mock("@/lib/direct-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/direct-upload")>()),
  putToStorage,
}));

import { DirectUploadError } from "@/lib/direct-upload";

import { largeFileRefusal, maxUploadLabel, needsDirectUpload, uploadLargeVersion } from "./large-upload";

const BIG = new File([new Uint8Array(5_000_000)], "GOM Rev 12.pdf", { type: "application/pdf" });
const LIMITS = { direct_uploads: true, max_bytes: 52428800 };
const TARGET = { file_key: "t1/abc_GOM.pdf", url: "https://bucket/k?sig", headers: { "Content-Type": "application/pdf" }, expires_in: 900 };

beforeEach(() => {
  vi.clearAllMocks();
  startLargeUploadAction.mockResolvedValue({ ok: true, data: TARGET });
  putToStorage.mockResolvedValue(undefined);
  completeLargeUploadAction.mockResolvedValue({ ok: true });
});

describe("large library uploads (#17)", () => {
  it("only files the web host can't carry go straight to storage", () => {
    expect(needsDirectUpload(BIG)).toBe(true);
    expect(needsDirectUpload(new File(["small"], "a.pdf"))).toBe(false);
    expect(needsDirectUpload(null)).toBe(false);
  });

  it("asks for a URL, sends the file there, then has it added", async () => {
    const progress = vi.fn();
    expect(await uploadLargeVersion("d-1", BIG, "Rev 12", progress)).toBeNull();
    expect(startLargeUploadAction).toHaveBeenCalledWith("d-1", {
      filename: "GOM Rev 12.pdf",
      contentType: "application/pdf",
      size: 5_000_000,
    });
    expect(putToStorage).toHaveBeenCalledWith(TARGET.url, TARGET.headers, BIG, progress);
    expect(completeLargeUploadAction).toHaveBeenCalledWith("d-1", {
      fileKey: "t1/abc_GOM.pdf",
      filename: "GOM Rev 12.pdf",
      notes: "Rev 12",
    });
  });

  it("stops at the first step that fails, saying why", async () => {
    startLargeUploadAction.mockResolvedValueOnce({ ok: false, error: "Files this large can't be uploaded on this server." });
    expect(await uploadLargeVersion("d-1", BIG, null, vi.fn())).toBe("Files this large can't be uploaded on this server.");
    expect(putToStorage).not.toHaveBeenCalled();

    putToStorage.mockRejectedValueOnce(new DirectUploadError("Storage refused the file (HTTP 403). Try again."));
    expect(await uploadLargeVersion("d-1", BIG, null, vi.fn())).toBe("Storage refused the file (HTTP 403). Try again.");
    expect(completeLargeUploadAction).not.toHaveBeenCalled();

    completeLargeUploadAction.mockResolvedValueOnce({ ok: false, error: "The file didn't reach storage. Upload it again." });
    expect(await uploadLargeVersion("d-1", BIG, null, vi.fn())).toBe("The file didn't reach storage. Upload it again.");
  });

  it("refuses what the server can't take, naming the limit", () => {
    expect(largeFileRefusal(BIG, LIMITS)).toBeNull();
    expect(largeFileRefusal(BIG, null)).toBe(
      "GOM Rev 12.pdf is too large: files over 3.8 MB can't be uploaded on this server.",
    );
    expect(largeFileRefusal(BIG, { direct_uploads: false, max_bytes: 52428800 })).toMatch(/over 3\.8 MB/);
    const huge = new File([new Uint8Array(10)], "huge.pdf");
    Object.defineProperty(huge, "size", { value: 60 * 1024 * 1024 });
    expect(largeFileRefusal(huge, LIMITS)).toBe("huge.pdf is too large: the library takes files up to 50 MB.");
    expect(maxUploadLabel(LIMITS)).toBe("50 MB");
  });
});
