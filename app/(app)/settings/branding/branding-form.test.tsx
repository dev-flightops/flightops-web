import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  extract: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  /** What the suggest form's action last returned, for a test to set. */
  extracted: { status: "idle" } as Record<string, unknown>,
  /** What Save's action last returned, for a test to set. */
  saved: { status: "idle" } as Record<string, unknown>,
}));
const downscale = vi.hoisted(() => vi.fn(async (file: File) => new Blob([`small ${file.name}`], { type: "image/jpeg" })));

vi.mock("./actions", () => ({
  extractBrandingAction: actions.extract,
  updateBrandingAction: actions.update,
  uploadHomeImageAction: actions.upload,
  removeHomeImageAction: actions.remove,
}));
vi.mock("@/lib/images/downscale", () => ({ downscalePhoto: downscale }));
// Next runs the form on React 19; the test runner has React 18, which has
// no useActionState. Each form's state is the one a test sets.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (action: unknown, initial: unknown) => [
    action === actions.extract ? actions.extracted : action === actions.update ? actions.saved : initial,
    () => {},
    false,
  ],
}));

import { BrandingForm } from "./branding-form";

const addressBox = () => screen.getByRole("textbox", { name: /picture’s address/ });
// jsdom's selectors don't match a quoted src holding "%", so read them.
const sources = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));

/**
 * Settings → Branding's image behind Home (#118): a link, previewed as
 * Home draws it, filled in from the website's own image when it names one.
 */
describe("the Home image", () => {
  it("previews the saved image as Home draws it", () => {
    const url = "https://cdn.brand.example/hero.jpg";
    const { container } = render(
      <BrandingForm initialPrimary={null} initialPrimaryDark={null} initialHomeImage={url} />,
    );
    expect(addressBox()).toHaveValue(url);
    expect(container.querySelector(`img[src="${url}"]`)).not.toBeNull();
    expect(screen.getByText("Good morning")).toBeInTheDocument();
  });

  it("says Home stays as it is without one, and previews a link as it's typed", async () => {
    const user = userEvent.setup();
    const { container } = render(<BrandingForm initialPrimary={null} initialPrimaryDark={null} />);
    expect(screen.getByText(/No image: Home shows the greeting/)).toBeInTheDocument();
    await user.type(addressBox(), "https://cdn.brand.example/a.jpg");
    expect(container.querySelector('img[src="https://cdn.brand.example/a.jpg"]')).not.toBeNull();
  });

  it("takes the website's own image from a suggestion", () => {
    actions.extracted = {
      status: "ok",
      primary: "#F4B221",
      primaryDark: "#CF971C",
      homeImage: "https://www.brand.example/og.jpg",
    };
    render(<BrandingForm initialPrimary={null} initialPrimaryDark={null} />);
    expect(addressBox()).toHaveValue("https://www.brand.example/og.jpg");
    expect(screen.getByText(/and the site's own image for Home/)).toBeInTheDocument();
    actions.extracted = { status: "idle" };
  });

  it("says when the address isn't an image, and won't save it (#158)", () => {
    // The client typed their website; the preview stayed blank and saved.
    const url = "https://www.brand.example/";
    const { container } = render(
      <BrandingForm initialPrimary={null} initialPrimaryDark={null} initialHomeImage={url} />,
    );
    fireEvent.error(container.querySelector(`img[src="${url}"]`)!);
    expect(screen.getByRole("alert")).toHaveTextContent(/isn.t an image we can show/);
    expect(screen.getByRole("button", { name: /Save brand theme/ })).toBeDisabled();
  });
});

/**
 * Or a picture uploaded from this computer (Greg, 13 Nov: both). It goes
 * up as soon as it's picked, made small first, and replaces the link.
 */
describe("the Home picture uploaded from this computer", () => {
  const UPLOADED = "2026-11-13T01:02:03.456789+00:00";
  const uploadedSrc = `/api/branding/home-image?v=${encodeURIComponent(UPLOADED)}`;

  it("sends a picked picture, made small, and shows it as Home will", async () => {
    const user = userEvent.setup();
    actions.upload.mockResolvedValueOnce({ ok: true, uploadedAt: UPLOADED });
    const { container } = render(
      <BrandingForm initialPrimary={null} initialPrimaryDark={null} initialHomeImage="https://cdn.brand.example/old.jpg" />,
    );
    await user.upload(screen.getByLabelText("Picture for Home"), new File(["camera"], "hangar.jpg", { type: "image/jpeg" }));
    expect(downscale).toHaveBeenCalledWith(expect.any(File), 2400, 900 * 1024);
    const sent = actions.upload.mock.calls[0][0] as FormData;
    expect((sent.get("image") as File).name).toBe("hangar.jpg");
    expect(await screen.findByRole("button", { name: "Replace picture" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove picture" })).toBeInTheDocument();
    expect(addressBox()).toHaveValue("");
    expect(sources(container)).toContain(uploadedSrc);
  });

  it("says why a picture was refused, and keeps what was there", async () => {
    const user = userEvent.setup();
    actions.upload.mockResolvedValueOnce({ ok: false, error: "That file isn't a picture. Choose a JPEG, PNG or WebP photo." });
    render(<BrandingForm initialPrimary={null} initialPrimaryDark={null} />);
    await user.upload(screen.getByLabelText("Picture for Home"), new File(["%PDF"], "manual.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That file isn't a picture.");
    expect(screen.getByRole("button", { name: "Upload a picture" })).toBeInTheDocument();
  });

  it("removes the uploaded picture", async () => {
    const user = userEvent.setup();
    actions.remove.mockResolvedValueOnce({ ok: true, uploadedAt: null });
    render(<BrandingForm initialPrimary={null} initialPrimaryDark={null} initialHomeImageUploadedAt={UPLOADED} />);
    expect(screen.getByText(/It's on Home now/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove picture" }));
    expect(await screen.findByRole("button", { name: "Upload a picture" })).toBeInTheDocument();
    expect(screen.getByText(/No image: Home shows the greeting/)).toBeInTheDocument();
  });

  it("says a typed address replaces the uploaded picture, and previews the address", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BrandingForm initialPrimary={null} initialPrimaryDark={null} initialHomeImageUploadedAt={UPLOADED} />,
    );
    expect(sources(container)).toContain(uploadedSrc);
    await user.type(addressBox(), "https://cdn.brand.example/new.jpg");
    expect(screen.getByText("Saving this address replaces the uploaded picture.")).toBeInTheDocument();
    expect(container.querySelector('img[src="https://cdn.brand.example/new.jpg"]')).not.toBeNull();
  });

  it("lets the uploaded picture go once an address is saved over it, as the server did", async () => {
    const user = userEvent.setup();
    const props = { initialPrimary: null, initialPrimaryDark: null, initialHomeImageUploadedAt: UPLOADED };
    const { container, rerender } = render(<BrandingForm {...props} />);
    await user.type(addressBox(), "https://cdn.brand.example/new.jpg");
    actions.saved = { status: "saved", homeImageUploadedAt: null };
    rerender(<BrandingForm {...props} />);
    expect(screen.getByRole("button", { name: "Upload a picture" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove picture" })).toBeNull();
    // Cleared again, the address leaves Home without a picture, not the old upload.
    await user.clear(addressBox());
    expect(sources(container)).not.toContain(uploadedSrc);
    expect(screen.getByText(/No image: Home shows the greeting/)).toBeInTheDocument();
    actions.saved = { status: "idle" };
  });

  it("never sends the file with Save", () => {
    render(<BrandingForm initialPrimary={null} initialPrimaryDark={null} />);
    expect(screen.getByLabelText("Picture for Home")).not.toHaveAttribute("name");
  });
});
