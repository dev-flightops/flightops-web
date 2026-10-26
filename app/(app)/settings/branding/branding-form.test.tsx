import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  extract: vi.fn(),
  update: vi.fn(),
  /** What the suggest form's action last returned, for a test to set. */
  extracted: { status: "idle" } as Record<string, unknown>,
}));

vi.mock("./actions", () => ({
  extractBrandingAction: actions.extract,
  updateBrandingAction: actions.update,
}));
// Next runs the form on React 19; the test runner has React 18, which has
// no useActionState. The suggest form's state is the one a test sets.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (action: unknown, initial: unknown) => [
    action === actions.extract ? actions.extracted : initial,
    () => {},
    false,
  ],
}));

import { BrandingForm } from "./branding-form";

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
    expect(screen.getByLabelText("Home image")).toHaveValue(url);
    expect(container.querySelector(`img[src="${url}"]`)).not.toBeNull();
    expect(screen.getByText("Good morning")).toBeInTheDocument();
  });

  it("says Home stays as it is without one, and previews a link as it's typed", async () => {
    const user = userEvent.setup();
    const { container } = render(<BrandingForm initialPrimary={null} initialPrimaryDark={null} />);
    expect(screen.getByText(/No image: Home shows the greeting/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Home image"), "https://cdn.brand.example/a.jpg");
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
    expect(screen.getByLabelText("Home image")).toHaveValue("https://www.brand.example/og.jpg");
    expect(screen.getByText(/and the site's own image for Home/)).toBeInTheDocument();
    actions.extracted = { status: "idle" };
  });
});
