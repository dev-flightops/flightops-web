import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandThemeStyle } from "./brand-theme-style";

const css = (primary: string | null, primaryDark: string | null = null) => {
  const { container } = render(
    <BrandThemeStyle primary={primary} primaryDark={primaryDark} />,
  );
  return container.querySelector("style")?.textContent ?? null;
};

describe("BrandThemeStyle", () => {
  it("renders nothing without a brand, so the default theme wins", () => {
    expect(css(null)).toBeNull();
  });

  it("emits the brand as channels the theme can put opacity on", () => {
    const out = css("#1d4ed8")!;
    expect(out).toContain("--brand-rgb: 29 78 216");
    expect(out).toContain("--brand-light-rgb:");
    expect(out).toContain("--brand-dark-rgb:");
  });

  it("applies inside the dark ink surfaces too", () => {
    // The top bar is a `.dark` island; a tenant's brand has to reach it.
    expect(css("#1d4ed8")).toMatch(/:root,\s*\.dark\s*\{/);
  });

  it("keeps a hover shade the tenant chose rather than deriving one", () => {
    expect(css("#1d4ed8", "#0f2a80")).toContain("--brand-dark-rgb: 15 42 128");
  });

  it("refuses a value that could break out of the style element", () => {
    // It lands inside <style>, so anything but a plain hex is dropped.
    expect(css("#ab2429;}body{display:none")).toBeNull();
    expect(css("red")).toBeNull();
    expect(css("</style><script>alert(1)</script>")).toBeNull();
  });
});
