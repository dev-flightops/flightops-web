import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/image as a plain <img>, less the two props the DOM has no use for.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    return <img {...(rest as object)} />;
  },
}));

import { PHOTO_CREDITS } from "@/components/landing/content";

import LandingPage from "./page";

describe("the landing page (#78)", () => {
  it("opens on the hero and walks through the platform", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Peregrine Flight Ops" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Peregrine Flight Ops" })).toBeTruthy();
    for (const name of [
      "One system for the whole operation",
      "Every flight, followed",
      "Mail, freight and passengers, planned to the pound",
      "What the platform checks for you",
      "Built for Part 135 operators",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
  });

  it("signs in from the nav and the closing band", () => {
    render(<LandingPage />);
    const nav = within(screen.getByRole("banner"));
    expect(nav.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(nav.getByRole("group", { name: "Colour theme" })).toBeTruthy();
    for (const link of screen.getAllByRole("link", { name: "Sign in" })) {
      expect(link.getAttribute("href")).toBe("/login");
    }
  });

  it("credits the photographs", () => {
    render(<LandingPage />);
    expect(within(screen.getByRole("contentinfo")).getByText(PHOTO_CREDITS)).toBeTruthy();
  });

  it("shows the product in the page's own theme", () => {
    render(<LandingPage />);
    const shots = screen.getAllByRole("img", { name: /The Flight Following board in the (dark|light) theme/ });
    expect(shots.map((s) => s.className.includes("theme-dark-only") || s.className.includes("theme-light-only"))).toEqual([true, true]);
  });
});
