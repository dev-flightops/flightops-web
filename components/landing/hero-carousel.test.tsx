import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/image as a plain <img>, less the two props the DOM has no use for.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    return <img {...(rest as object)} />;
  },
}));

import { SLIDES } from "./content";
import { HeroCarousel, SLIDE_MS } from "./hero-carousel";

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

const current = () =>
  screen.getAllByRole("group", { hidden: true }).filter((g) => g.getAttribute("aria-roledescription") === "slide" && g.getAttribute("aria-hidden") === "false");

describe("HeroCarousel (#78)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
  });
  afterEach(() => vi.useRealTimers());

  it("shows the first slide, then the next every eight seconds, round to the first", () => {
    render(<HeroCarousel slides={SLIDES} />);
    expect(current().map((g) => g.getAttribute("aria-label"))).toEqual(["1 of 5"]);
    act(() => void vi.advanceTimersByTime(SLIDE_MS));
    expect(current()[0].getAttribute("aria-label")).toBe("2 of 5");
    // One slide at a time: each timer is set once the last change renders.
    for (let i = 0; i < 4; i++) act(() => void vi.advanceTimersByTime(SLIDE_MS));
    expect(current()[0].getAttribute("aria-label")).toBe("1 of 5");
  });

  it("holds while the pointer is over it", () => {
    render(<HeroCarousel slides={SLIDES} />);
    fireEvent.mouseEnter(screen.getByRole("region", { name: "Peregrine Flight Ops" }));
    act(() => void vi.advanceTimersByTime(SLIDE_MS * 2));
    expect(current()[0].getAttribute("aria-label")).toBe("1 of 5");
  });

  it("stops for good with Pause, and announces slides while paused", () => {
    render(<HeroCarousel slides={SLIDES} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => void vi.advanceTimersByTime(SLIDE_MS * 3));
    expect(current()[0].getAttribute("aria-label")).toBe("1 of 5");
    expect(screen.getByRole("button", { name: "Play" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("moves with its markers and the arrow keys", () => {
    render(<HeroCarousel slides={SLIDES} />);
    fireEvent.click(screen.getByRole("button", { name: `Slide 4: ${SLIDES[3].title}` }));
    expect(current()[0].getAttribute("aria-label")).toBe("4 of 5");
    const region = screen.getByRole("region", { name: "Peregrine Flight Ops" });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(current()[0].getAttribute("aria-label")).toBe("5 of 5");
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(current()[0].getAttribute("aria-label")).toBe("1 of 5");
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(current()[0].getAttribute("aria-label")).toBe("5 of 5");
  });

  it("does not move on its own for anyone who asked for reduced motion", () => {
    mockReducedMotion(true);
    render(<HeroCarousel slides={SLIDES} />);
    act(() => void vi.advanceTimersByTime(SLIDE_MS * 3));
    expect(current()[0].getAttribute("aria-label")).toBe("1 of 5");
  });

  it("keeps its actions out of the slides, so nothing hidden can take focus", () => {
    render(<HeroCarousel slides={SLIDES} />);
    for (const slide of screen.getAllByRole("group", { hidden: true }).filter((g) => g.getAttribute("aria-roledescription") === "slide")) {
      expect(slide.querySelector("a, button")).toBeNull();
    }
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });
});
