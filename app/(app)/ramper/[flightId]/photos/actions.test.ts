import { describe, expect, it, vi } from "vitest";

const { TestApiError, uploadRampPhoto } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, uploadRampPhoto: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ uploadRampPhoto, deleteRampPhoto: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { uploadRampPhotoAction } from "./actions";

describe("uploadRampPhotoAction refused by role (29 Sep)", () => {
  it("says who uploads", async () => {
    uploadRampPhoto.mockRejectedValueOnce(new TestApiError(403, "/ground/flights/f-1/photos", "insufficient_role"));
    const form = new FormData();
    form.set("photo", new File(["x"], "load.jpg", { type: "image/jpeg" }));
    form.set("photo_type", "secured_load");
    expect(await uploadRampPhotoAction("f-1", { status: "idle" }, form)).toEqual({
      status: "error",
      message:
        "Only Ground Ops, dispatchers, the Chief Pilot, the Director of Operations or an Exec Admin can upload ramp photos.",
    });
  });
});

describe("uploadRampPhotoAction refused by type (1 Oct)", () => {
  function photoForm(name: string, type: string) {
    const form = new FormData();
    form.set("photo", new File(["x"], name, { type }));
    form.set("photo_type", "secured_load");
    return form;
  }

  it("asks for a JPEG when the photo is HEIC", async () => {
    uploadRampPhoto.mockRejectedValueOnce(
      new TestApiError(422, "/ground/flights/f-1/photos", "photo_must_be_jpeg_png_webp_or_gif"),
    );
    expect(await uploadRampPhotoAction("f-1", { status: "idle" }, photoForm("IMG_0001.HEIC", "image/heic"))).toEqual({
      status: "error",
      message: "HEIC photos can't be shown in most browsers. Export it as JPEG and upload that.",
    });
  });

  it("says what a photo is when the file is not one", async () => {
    uploadRampPhoto.mockRejectedValueOnce(
      new TestApiError(422, "/ground/flights/f-1/photos", "content_type_must_be_image"),
    );
    expect(await uploadRampPhotoAction("f-1", { status: "idle" }, photoForm("plan.svg", "image/svg+xml"))).toEqual({
      status: "error",
      message: "That file isn't a photo. Use a JPEG, PNG, WebP or GIF image.",
    });
  });
});
