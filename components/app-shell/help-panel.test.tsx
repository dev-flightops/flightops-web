import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

let pathname = "/reports/bi";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { HELP_ENTRIES } from "@/lib/help/catalogue";

import { HelpPanel } from "./help-panel";

/**
 * The `?` panel.
 *
 * What needs pinning: it opens on the page you are standing on, it
 * admits when a page has no article, and it can name a related route
 * that has no article of its own — which was a real bug, silently
 * dropping twelve links.
 */

function open(route: string) {
  pathname = route;
  render(<HelpPanel />);
  return userEvent.setup();
}

describe("opening on the current page", () => {
  it("shows the article for the route", async () => {
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(
      screen.getByTestId("help-article-/reports/bi"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Business Intelligence" }),
    ).toBeInTheDocument();
  });

  it("names the article on the button, before it is opened", async () => {
    open("/reports/bi");
    expect(
      screen.getByRole("button", { name: "Help" }),
    ).toHaveAttribute("title", "Help — Business Intelligence");
  });

  it("falls back to the nearest parent article", async () => {
    const user = open("/reports/regulatory/t100");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(
      screen.getByRole("heading", { name: "Regulatory returns" }),
    ).toBeInTheDocument();
  });

  it("renders the sections an operator asks for", async () => {
    const user = open("/reports/sim");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByText("How to use it")).toBeInTheDocument();
    expect(
      screen.getByText("Where the numbers come from"),
    ).toBeInTheDocument();
    expect(screen.getByText("Worth knowing")).toBeInTheDocument();
  });
});

describe("a page with no article", () => {
  it("says so and names the route", async () => {
    // Rather than a blank panel or a generic paragraph that reads like
    // help and contains nothing.
    const user = open("/housing");
    await user.click(screen.getByRole("button", { name: "Help" }));
    const panel = screen.getByTestId("help-no-article");
    expect(panel).toHaveTextContent("No help written for");
    expect(panel).toHaveTextContent("/housing");
  });

  it("says how many pages do have articles", async () => {
    const user = open("/housing");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(
      screen.getByTestId("help-no-article"),
    ).toHaveTextContent(`${HELP_ENTRIES.length} pages have articles`);
  });

  it("offers every article as a starting point", async () => {
    const user = open("/housing");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(
      screen.getByRole("link", { name: "Business Intelligence" }),
    ).toHaveAttribute("href", "/reports/bi");
  });
});

describe("related links", () => {
  it("names a related route that has no article of its own", async () => {
    // The bug this covers: the panel filtered related routes to ones
    // with articles, which silently dropped twelve links. Weather has
    // no article, and "Weather" is still the right label — from the
    // nav registry rather than a third hand-written copy.
    const user = open("/dispatch");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(
      screen.getByRole("link", { name: "Weather" }),
    ).toHaveAttribute("href", "/weather");
  });

  it("prefers the article's own title when there is one", async () => {
    const user = open("/dispatch");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(
      screen.getByRole("link", { name: "Dispatch Intelligence" }),
    ).toHaveAttribute("href", "/dispatch/intelligence");
  });
});

describe("search", () => {
  it("ignores a query too short to mean anything", async () => {
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.type(screen.getByLabelText("Search help"), "a");
    // Still showing the contextual article, not an empty result list.
    expect(
      screen.getByTestId("help-article-/reports/bi"),
    ).toBeInTheDocument();
  });

  it("replaces the article with results once it is long enough", async () => {
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.type(screen.getByLabelText("Search help"), "carrier");
    expect(
      screen.getByTestId("help-result-/reports/sim"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("help-article-/reports/bi"),
    ).not.toBeInTheDocument();
  });

  it("says nothing is written rather than showing an empty list", async () => {
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.type(screen.getByLabelText("Search help"), "zzzqqq");
    expect(screen.getByText(/Nothing written about/)).toBeInTheDocument();
  });
});

describe("closing", () => {
  it("closes on Escape", async () => {
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on the Close button", async () => {
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.click(screen.getByRole("button", { name: "Close help" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
