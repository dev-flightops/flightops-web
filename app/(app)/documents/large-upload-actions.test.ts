import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, getVersionUploadUrl, completeVersionUpload, revalidatePath } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getVersionUploadUrl: vi.fn(), completeVersionUpload: vi.fn(), revalidatePath: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/documents", () => ({ getVersionUploadUrl, completeVersionUpload }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { completeLargeUploadAction, startLargeUploadAction } from "./actions";

beforeEach(() => vi.clearAllMocks());

describe("the two ends of a large upload (#17)", () => {
  it("asks the service for a URL in its own terms", async () => {
    getVersionUploadUrl.mockResolvedValue({ file_key: "k", url: "u", headers: {}, expires_in: 900 });
    const res = await startLargeUploadAction("d-1", { filename: "GOM.pdf", contentType: "", size: 5_000_000 });
    expect(getVersionUploadUrl).toHaveBeenCalledWith("d-1", {
      filename: "GOM.pdf",
      content_type: "application/octet-stream",
      size_bytes: 5_000_000,
    });
    expect(res).toEqual({ ok: true, data: { file_key: "k", url: "u", headers: {}, expires_in: 900 } });
  });

  it("says plainly when the server has no bucket", async () => {
    getVersionUploadUrl.mockRejectedValue(new TestApiError(409, "/x", '{"detail":"direct_upload_unavailable"}'));
    const res = await startLargeUploadAction("d-1", { filename: "GOM.pdf", contentType: "application/pdf", size: 5e6 });
    expect(res).toEqual({ ok: false, error: "Files this large can't be uploaded on this server." });
  });

  it("adds the file and refreshes the library", async () => {
    completeVersionUpload.mockResolvedValue({});
    const res = await completeLargeUploadAction("d-1", { fileKey: "k", filename: "GOM.pdf", notes: null });
    expect(completeVersionUpload).toHaveBeenCalledWith("d-1", { file_key: "k", filename: "GOM.pdf", notes: null });
    expect(res).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/documents/d-1");
  });

  it("explains a file that never arrived, or was added already", async () => {
    completeVersionUpload.mockRejectedValueOnce(new TestApiError(404, "/x", '{"detail":"upload_not_found"}'));
    expect((await completeLargeUploadAction("d-1", { fileKey: "k", filename: "a", notes: null })).error).toBe(
      "The file didn't reach storage. Upload it again.",
    );
    completeVersionUpload.mockRejectedValueOnce(new TestApiError(409, "/x", '{"detail":"upload_already_added"}'));
    expect((await completeLargeUploadAction("d-1", { fileKey: "k", filename: "a", notes: null })).error).toBe(
      "That file has already been added as a version.",
    );
  });
});
