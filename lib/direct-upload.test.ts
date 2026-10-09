import { afterEach, describe, expect, it, vi } from "vitest";

import { DirectUploadError, putToStorage } from "./direct-upload";

/** Just enough of XMLHttpRequest to see what was sent and drive the end. */
class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("sending a large file straight to storage (#17)", () => {
  const headers = { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" };

  it("PUTs the file with exactly the signed headers and reports progress", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const file = new Blob(["%PDF"]);
    const seen: number[] = [];
    const sent = putToStorage("https://bucket.example/k?sig", headers, file, (f) => seen.push(f));
    const xhr = FakeXhr.last;
    expect([xhr.method, xhr.url, xhr.headers, xhr.body]).toEqual(["PUT", "https://bucket.example/k?sig", headers, file]);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 });
    xhr.status = 200;
    xhr.onload?.();
    await expect(sent).resolves.toBeUndefined();
    expect(seen).toEqual([0.25]);
  });

  it("says storage refused it", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const sent = putToStorage("u", headers, new Blob(["x"]));
    FakeXhr.last.status = 403;
    FakeXhr.last.onload?.();
    await expect(sent).rejects.toThrow(new DirectUploadError("Storage refused the file (HTTP 403). Try again."));
  });

  it("says it couldn't be sent when the connection (or CORS) fails", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const sent = putToStorage("u", headers, new Blob(["x"]));
    FakeXhr.last.onerror?.();
    await expect(sent).rejects.toThrow(/couldn't be sent to storage/);
  });
});
