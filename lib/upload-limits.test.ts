import { describe, expect, it } from "vitest";

import {
  formOversizeMessage,
  MAX_UPLOAD_BYTES,
  oversizeMessage,
} from "./upload-limits";

/**
 * Uploads pass through a Vercel function (4.5 MB, 4 MB through proxy.ts).
 * A file over the limit has to be stopped in the browser: sent, it meets
 * the platform's 413 before the server action runs, and the page shows the
 * error boundary instead of the form's message.
 */

function fileOf(size: number, name = "gom.pdf"): File {
  const file = new File(["x"], name);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function formWith(...files: File[]): HTMLFormElement {
  const form = document.createElement("form");
  const text = document.createElement("input");
  text.name = "title";
  form.appendChild(text);
  const input = document.createElement("input");
  input.type = "file";
  Object.defineProperty(input, "files", { value: files });
  form.appendChild(input);
  return form;
}

describe("upload limit", () => {
  it("stays under Vercel's 4 MB with room for the rest of the form", () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4_000_000);
  });

  it("lets a file at the limit through", () => {
    expect(oversizeMessage(fileOf(MAX_UPLOAD_BYTES))).toBeNull();
  });

  it("names the file, its size and the limit when it is over", () => {
    expect(oversizeMessage(fileOf(52_400_000, "GOM rev 7.pdf"))).toBe(
      "GOM rev 7.pdf is 52.4 MB. Files over 3.8 MB can't be uploaded yet.",
    );
  });

  it("never calls a refused file the size of the limit", () => {
    expect(oversizeMessage(fileOf(MAX_UPLOAD_BYTES + 1, "scan.pdf"))).toBe(
      "scan.pdf is 3.9 MB. Files over 3.8 MB can't be uploaded yet.",
    );
  });

  it("checks every file input in a form", () => {
    expect(formOversizeMessage(formWith(fileOf(1_000)))).toBeNull();
    expect(formOversizeMessage(formWith(fileOf(1_000), fileOf(4_200_000, "scan.pdf")))).toMatch(
      /^scan\.pdf is 4\.2 MB/,
    );
  });

  it("is fine with no file chosen", () => {
    expect(formOversizeMessage(formWith())).toBeNull();
  });
});
