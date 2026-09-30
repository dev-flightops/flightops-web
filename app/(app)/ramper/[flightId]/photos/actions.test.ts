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
