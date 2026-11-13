import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadHomeImage, removeHomeImage, updateCompanyProfile, revalidatePath, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { uploadHomeImage: vi.fn(), removeHomeImage: vi.fn(), updateCompanyProfile: vi.fn(), revalidatePath: vi.fn(), TestApiError };
});
vi.mock("@/lib/api/auth", () => ({
  uploadHomeImage,
  removeHomeImage,
  extractBrandingFromUrl: vi.fn(),
  updateCompanyProfile,
}));
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { homeImageSource } from "@/lib/branding/home-image";

import { removeHomeImageAction, updateBrandingAction, uploadHomeImageAction } from "./actions";

const form = (image?: Blob, name = "hangar.jpg") => {
  const body = new FormData();
  if (image) body.append("image", image, name);
  return body;
};
const picture = new Blob(["jpeg"], { type: "image/jpeg" });

describe("the Home picture's actions", () => {
  beforeEach(() => {
    uploadHomeImage.mockReset().mockResolvedValue({ home_image_uploaded_at: "2026-11-13T01:02:03Z" });
    removeHomeImage.mockReset().mockResolvedValue({ home_image_uploaded_at: null });
    revalidatePath.mockReset();
  });

  it("uploads the picture under its name, and refreshes every page's Home", async () => {
    expect(await uploadHomeImageAction(form(picture))).toEqual({ ok: true, uploadedAt: "2026-11-13T01:02:03Z" });
    expect(uploadHomeImage).toHaveBeenCalledWith(expect.any(Blob), "hangar.jpg");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("asks for a picture when none was sent", async () => {
    expect(await uploadHomeImageAction(form())).toEqual({ ok: false, error: "Choose a picture first." });
    expect(uploadHomeImage).not.toHaveBeenCalled();
  });

  it.each([
    [422, '{"detail":"content_type_must_be_image"}', "That file isn't a picture. Choose a JPEG, PNG or WebP photo."],
    [422, '{"detail":"image_must_be_jpeg_png_webp_or_gif"}', "That picture is HEIC, which most browsers can't show. Save it as a JPEG, then upload it."],
    [422, '{"detail":"image_unreadable"}', "That picture couldn't be read. Save it again as a JPEG, then upload it."],
    [413, "<html>413 Request Entity Too Large</html>", "That picture is too large to send. Choose a smaller one."],
    [403, '{"detail":"forbidden"}', "Only an Exec Admin or Director of Operations can change the Home picture."],
    [500, "oops", "Couldn't save the picture (HTTP 500). Try again in a moment."],
  ])("says why an upload was refused (HTTP %i)", async (status, body, error) => {
    uploadHomeImage.mockRejectedValueOnce(new TestApiError(status, "/auth/settings/company/home-image", body));
    expect(await uploadHomeImageAction(form(picture))).toEqual({ ok: false, error });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("removes the picture", async () => {
    expect(await removeHomeImageAction()).toEqual({ ok: true, uploadedAt: null });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it.each([
    ["an address replaces it", "https://cdn.brand.example/new.jpg", null],
    ["no address keeps it", "", "2026-11-13T01:02:03Z"],
  ])("says what Save kept of the uploaded picture: %s", async (_, link, kept) => {
    updateCompanyProfile.mockReset().mockResolvedValue({ home_image_url: link || null, home_image_uploaded_at: kept });
    const body = new FormData();
    body.append("brand_primary_color", "");
    body.append("brand_primary_dark_color", "");
    body.append("home_image_url", link);
    expect(await updateBrandingAction({ status: "idle" }, body)).toEqual({ status: "saved", homeImageUploadedAt: kept });
    expect(updateCompanyProfile).toHaveBeenCalledWith({ brand_primary_color: "", brand_primary_dark_color: "", home_image_url: link });
  });
});

describe("homeImageSource", () => {
  it("prefers the uploaded picture, by its upload time", () => {
    expect(
      homeImageSource({ home_image_url: "https://x.example/a.jpg", home_image_uploaded_at: "2026-11-13T01:02:03+00:00" }),
    ).toBe("/api/branding/home-image?v=2026-11-13T01%3A02%3A03%2B00%3A00");
  });

  it("else the link, else none", () => {
    expect(homeImageSource({ home_image_url: " https://x.example/a.jpg " })).toBe("https://x.example/a.jpg");
    expect(homeImageSource({ home_image_url: null, home_image_uploaded_at: null })).toBeNull();
    expect(homeImageSource(null)).toBeNull();
  });
});
