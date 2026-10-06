import { beforeEach, describe, expect, it, vi } from "vitest";

const { readDocumentText, startLimitReading, getLimitReading, TestApiError } = vi.hoisted(
  () => {
    class TestApiError extends Error {
      constructor(
        public status: number,
        public path: string,
        message: string,
      ) {
        super(message);
        this.name = "ApiError";
      }
    }
    return {
      readDocumentText: vi.fn(),
      startLimitReading: vi.fn(),
      getLimitReading: vi.fn(),
      TestApiError,
    };
  },
);

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/document-limits", () => ({
  readDocumentText,
  startLimitReading,
  getLimitReading,
}));

import { getReadingAction, readDocumentLimitsAction } from "./document-limits-actions";

const DOC = "11111111-1111-4111-8111-111111111111";
const RUN = "22222222-2222-4222-8222-222222222222";
const refusal = (status: number, detail: string) =>
  new TestApiError(status, "/x", JSON.stringify({ detail }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readDocumentLimitsAction", () => {
  it("makes sure the text is read, then starts a reading", async () => {
    readDocumentText.mockResolvedValue({ text_status: "extracted", page_count: 5 });
    startLimitReading.mockResolvedValue({ id: RUN, document_id: DOC, status: "running" });
    expect(await readDocumentLimitsAction(DOC)).toEqual({
      ok: true,
      reading: { id: RUN, document_id: DOC, status: "running" },
    });
    expect(readDocumentText).toHaveBeenCalledWith(DOC);
    expect(startLimitReading).toHaveBeenCalledWith(DOC);
  });

  it("says why a file can't be read, without asking the reader", async () => {
    readDocumentText.mockResolvedValue({ text_status: "no_text", page_count: 12 });
    const result = await readDocumentLimitsAction(DOC);
    expect(result).toEqual({
      ok: false,
      error:
        "This file has no text to read — a scan, perhaps. Upload a PDF with selectable text.",
    });
    expect(startLimitReading).not.toHaveBeenCalled();
  });

  it("passes on the service's refusals in words", async () => {
    readDocumentText.mockResolvedValue({ text_status: "extracted" });
    startLimitReading.mockRejectedValueOnce(refusal(503, "anthropic_not_configured"));
    expect(await readDocumentLimitsAction(DOC)).toEqual({
      ok: false,
      error: "Reading documents isn't set up on this deployment.",
    });

    readDocumentText.mockRejectedValueOnce(refusal(409, "document_has_no_file"));
    expect(await readDocumentLimitsAction(DOC)).toEqual({
      ok: false,
      error: "That document has no file uploaded yet.",
    });

    readDocumentText.mockRejectedValueOnce(refusal(403, "forbidden"));
    expect(await readDocumentLimitsAction(DOC)).toEqual({
      ok: false,
      error:
        "Only a Chief Pilot, Director of Operations or Exec Admin can read documents for limits.",
    });
  });

  it("refuses an id that isn't a document's", async () => {
    expect(await readDocumentLimitsAction("../../billing")).toEqual({
      ok: false,
      error: "Pick a document.",
    });
    expect(readDocumentText).not.toHaveBeenCalled();
  });
});

describe("getReadingAction", () => {
  it("asks after a reading", async () => {
    getLimitReading.mockResolvedValue({ id: RUN, status: "done" });
    expect(await getReadingAction(RUN)).toEqual({ ok: true, reading: { id: RUN, status: "done" } });
    expect(getLimitReading).toHaveBeenCalledWith(RUN);
  });
});
