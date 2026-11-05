import { describe, expect, it } from "vitest";

import type { LessonMedia } from "@/lib/api/academy";

import {
  fileRefusalBeforeSending,
  formatBytes,
  lessonNumbersText,
  mediaFileUrl,
  mediaRefusalWords,
  mediaSourceText,
  mediaSummary,
  remainingText,
} from "./media";

const item = (over: Partial<LessonMedia>): LessonMedia => ({
  id: "m1",
  lesson_id: "l1",
  ordinal: 0,
  kind: "video",
  title: "Icing",
  must_finish: true,
  source: "file",
  filename: "ice.mp4",
  size_bytes: 3 * 1024 * 1024,
  link_url: null,
  link_provider: null,
  link_ref: null,
  document_id: null,
  ...over,
});

describe("where a file comes from", () => {
  it("an upload through the app, a library document through its download, a link as it is", () => {
    expect(mediaFileUrl(item({}))).toBe("/api/academy/media/m1");
    expect(mediaFileUrl(item({ source: "document", document_id: "d1" }))).toBe("/api/documents/d1/download");
    expect(mediaFileUrl(item({ source: "link", link_url: "https://x.example/a.mp4" }))).toBe("https://x.example/a.mp4");
  });

  it("says where each came from, for the author", () => {
    expect(mediaSourceText(item({}))).toBe("ice.mp4 (3.0 MB)");
    expect(mediaSourceText(item({ source: "document" }))).toBe("From the document library");
    expect(mediaSourceText(item({ source: "link", link_provider: "youtube" }))).toBe("YouTube");
    expect(mediaSourceText(item({ source: "link", link_provider: "vimeo" }))).toBe("Vimeo");
    expect(mediaSourceText(item({ source: "link", link_provider: "file" }))).toBe("Video file on the web");
  });

  it("sizes", () => {
    expect(formatBytes(500)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
  });
});

describe("in words", () => {
  it("what's in a lesson, on the outline", () => {
    expect(mediaSummary([item({ kind: "image" }), item({ kind: "video" }), item({ kind: "video" })])).toBe("Video · Picture");
    expect(mediaSummary([item({ kind: "pdf" })])).toBe("PDF");
    expect(mediaSummary([])).toBe("");
  });

  it("what's left before the lesson can go on", () => {
    expect(remainingText([item({})])).toBe("Watch the video to the end to continue.");
    expect(remainingText([item({ kind: "pdf" })])).toBe("Page through the PDF to the end to continue.");
    expect(remainingText([item({}), item({ kind: "pdf" })])).toBe("Watch the video and page through the PDF to the end to continue.");
    expect(remainingText([item({}), item({})])).toBe("Watch 2 videos to the end to continue.");
    expect(remainingText([item({ kind: "pdf" }), item({ kind: "pdf" })])).toBe("Page through 2 PDFs to the end to continue.");
  });

  it("the earlier lessons a quiz waits for", () => {
    expect(lessonNumbersText([1])).toBe("lesson 1");
    expect(lessonNumbersText([1, 3])).toBe("lessons 1 and 3");
    expect(lessonNumbersText([1, 2, 4])).toBe("lessons 1, 2 and 4");
  });

  it("the service's refusals", () => {
    expect(mediaRefusalWords('{"detail":"save_slides_as_pdf"}')).toMatch(/Save As, PDF/);
    expect(mediaRefusalWords('{"detail":"unsupported_video_link"}')).toMatch(/YouTube or Vimeo/);
    expect(mediaRefusalWords('{"detail":"something_else"}')).toBeNull();
    expect(mediaRefusalWords("<html>")).toBeNull();
  });

  it("a PowerPoint file is stopped before it's sent", () => {
    expect(fileRefusalBeforeSending("Winter.PPTX")).toMatch(/Save As, PDF/);
    expect(fileRefusalBeforeSending("old.ppt")).toMatch(/Save As, PDF/);
    expect(fileRefusalBeforeSending("winter.pdf")).toBeNull();
  });
});
