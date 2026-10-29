import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/schedule", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { onRouterTransitionStart } from "@/instrumentation-client";

import { GIVE_UP_MS, NavigationProgress, SHOW_AFTER_MS } from "./navigation-progress";

const bar = () => screen.queryByRole("progressbar", { name: "Loading page" });

function navigate(url: string) {
  act(() => onRouterTransitionStart(url, "push"));
}

function arrive(pathname: string, search = "") {
  nav.pathname = pathname;
  nav.search = search;
}

describe("NavigationProgress (#142)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    arrive("/schedule");
    window.history.replaceState(null, "", "/schedule");
    window.__flightopsNavigation = undefined;
  });
  afterEach(() => vi.useRealTimers());

  it("shows while another page loads, and goes when it has arrived", () => {
    const { rerender } = render(<NavigationProgress />);
    navigate("/dispatch");
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS - 1));
    expect(bar()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(bar()).toBeInTheDocument();

    arrive("/dispatch");
    rerender(<NavigationProgress />);
    expect(bar()).toBeNull();
  });

  it("shows for a change within the page: a date, a filter, a picked flight", () => {
    const { rerender } = render(<NavigationProgress />);
    navigate("/schedule?date=2026-10-30");
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS));
    expect(bar()).toBeInTheDocument();

    arrive("/schedule", "date=2026-10-30");
    rerender(<NavigationProgress />);
    expect(bar()).toBeNull();
  });

  it("shows nothing for a navigation quicker than the delay", () => {
    const { rerender } = render(<NavigationProgress />);
    navigate("/dispatch");
    arrive("/dispatch");
    rerender(<NavigationProgress />);
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS * 4));
    expect(bar()).toBeNull();
  });

  it("shows nothing when there is nothing to load: the same address, or only its hash", () => {
    render(<NavigationProgress />);
    navigate("/schedule");
    navigate("/schedule#leg-2");
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS * 4));
    expect(bar()).toBeNull();
  });

  it("shows for a navigation that started before it was listening", () => {
    // A click as the page loaded: Next started it before the bar hydrated.
    onRouterTransitionStart("/dispatch?flight=abc", "push");
    const { rerender } = render(<NavigationProgress />);
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS));
    expect(bar()).toBeInTheDocument();

    arrive("/dispatch", "flight=abc");
    rerender(<NavigationProgress />);
    expect(bar()).toBeNull();
    expect(window.__flightopsNavigation).toBeUndefined();
  });

  it("shows nothing at first for a navigation that has already arrived", () => {
    onRouterTransitionStart("/schedule", "push");
    render(<NavigationProgress />);
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS * 4));
    expect(bar()).toBeNull();
  });

  it("gives up on a navigation that never arrives", () => {
    render(<NavigationProgress />);
    navigate("/reports");
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS));
    expect(bar()).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(GIVE_UP_MS));
    expect(bar()).toBeNull();
  });

  it("stands still for reduced motion", () => {
    render(<NavigationProgress />);
    navigate("/dispatch");
    act(() => vi.advanceTimersByTime(SHOW_AFTER_MS));
    const sweep = bar()?.firstElementChild;
    expect(sweep).toHaveClass("motion-safe:animate-ff-sweep", "motion-reduce:w-full");
  });
});
