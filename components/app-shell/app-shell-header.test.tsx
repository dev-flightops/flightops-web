import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/flight-following"),
}));

import { AppShellHeader } from "./app-shell-header";

/** Loads the bar's logo as an image of the given size. */
function load(container: HTMLElement, width: number, height: number) {
  const img = container.querySelector("img")!;
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: width });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: height });
  fireEvent.load(img);
}

describe("the top bar's operator logo", () => {
  it("leaves the name to screen readers beside a wordmark, which already spells it", () => {
    const { container } = render(
      <AppShellHeader brand="Sample Air" logoUrl="https://example.test/logo.svg" showDepartmentNav={false} />,
    );
    load(container, 220, 48);
    expect(container.querySelector('img[src="https://example.test/logo.svg"]')).not.toBeNull();
    expect(screen.getByText("Sample Air")).toHaveClass("sr-only");
    // The link home still says whose it is.
    expect(screen.getByRole("link", { name: "Sample Air" }).querySelector("img")).not.toBeNull();
  });

  it("keeps the name beside an emblem, which does not", () => {
    const { container } = render(
      <AppShellHeader brand="Sample Air" logoUrl="https://example.test/mark.png" showDepartmentNav={false} />,
    );
    load(container, 64, 64);
    expect(container.querySelector("img")).not.toBeNull();
    expect(screen.getByText("Sample Air")).not.toHaveClass("sr-only");
  });

  it("keeps the plate hidden until the logo has loaded", () => {
    // The demo's dead logo URL is slow to fail: the empty plate showed
    // for as long as the request took.
    const { container } = render(
      <AppShellHeader brand="Sample Air" logoUrl="https://example.test/slow.png" showDepartmentNav={false} />,
    );
    const plate = container.querySelector("img")!.parentElement!;
    expect(plate).toHaveClass("hidden");
    expect(screen.getByText("Sample Air")).not.toHaveClass("sr-only");
    load(container, 220, 48);
    expect(container.querySelector("img")!.parentElement).not.toHaveClass("hidden");
  });

  it("drops the plate when the logo will not load, keeping the name", () => {
    // The demo's logo URL was dead: the bar showed an empty white box.
    const { container } = render(
      <AppShellHeader brand="Sample Air" logoUrl="https://example.test/gone.png" showDepartmentNav={false} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: "Sample Air" }).querySelector(".bg-white")).toBeNull();
    expect(screen.getByText("Sample Air")).not.toHaveClass("sr-only");
  });

  it("shows the name alone when no logo is set", () => {
    const { container } = render(<AppShellHeader brand="Sample Air" showDepartmentNav={false} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Sample Air")).not.toHaveClass("sr-only");
  });
});
