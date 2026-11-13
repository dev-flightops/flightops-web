import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downscalePhoto } from "./downscale";

/** A canvas whose JPEG grows with its width and quality, as a photo's does. */
const drawn: { width: number; quality: number }[] = [];

beforeEach(() => {
  drawn.length = 0;
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 4000, height: 2000, close: vi.fn() })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    _type?: string,
    quality?: number,
  ) {
    drawn.push({ width: this.width, quality: quality ?? 1 });
    callback(new Blob([new Uint8Array(Math.round(this.width * (quality ?? 1) * 400))], { type: "image/jpeg" }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const photo = new File(["camera bytes"], "hero.jpg", { type: "image/jpeg" });

describe("downscalePhoto", () => {
  it("draws a village photo once at 1,600 px, as before", async () => {
    const blob = await downscalePhoto(photo);
    expect(drawn).toEqual([{ width: 1600, quality: 0.85 }]);
    expect(blob.size).toBe(544_000);
  });

  it("steps the quality down until the picture fits", async () => {
    const blob = await downscalePhoto(photo, 2400, 600_000);
    expect(drawn.map((d) => d.quality)).toEqual([0.85, 0.7, 0.55]);
    expect(blob.size).toBe(528_000);
  });

  it("then makes it smaller, a quarter at a time", async () => {
    const blob = await downscalePhoto(photo, 2400, 300_000);
    expect([...new Set(drawn.map((d) => d.width))]).toEqual([2400, 1800, 1350]);
    expect(blob.size).toBeLessThanOrEqual(300_000);
  });

  it("gives the smallest it made when nothing fits", async () => {
    const blob = await downscalePhoto(photo, 2400, 10);
    expect(drawn).toHaveLength(9);
    expect(blob.size).toBe(Math.round(1350 * 0.55 * 400));
  });

  it("sends what the browser can't decode as it is", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("HEIC"))));
    expect(await downscalePhoto(photo, 2400, 600_000)).toBe(photo);
  });
});
