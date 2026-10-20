import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { themeFromCookie } from "@/lib/theme/theme-mode";

import { ThemeProvider } from "./theme-provider";
import { ThemeSwitch } from "./theme-switch";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.cookie = "fo-theme=; max-age=0; path=/";
});

describe("theme (#78)", () => {
  it("is dark unless light was chosen", () => {
    expect(themeFromCookie(undefined)).toBe("dark");
    expect(themeFromCookie("anything")).toBe("dark");
    expect(themeFromCookie("light")).toBe("light");
  });

  it("starts on the mode the server rendered, and switches the page", () => {
    render(
      <ThemeProvider initial="dark">
        <ThemeSwitch />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "dark" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.cookie).toContain("fo-theme=light");
    expect(screen.getByRole("button", { name: "light" }).getAttribute("aria-pressed")).toBe("true");
  });
});
