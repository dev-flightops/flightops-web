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

describe("escaping the header's containing block", () => {
  /**
   * The bug: the app shell's header is `sticky ... backdrop-blur`, and
   * `backdrop-filter` makes an element a containing block for its
   * fixed-position descendants. Rendered in place, this drawer's
   * `fixed h-full` resolved against the 84px header rather than the
   * viewport, so it opened as an 83px strip with the article clipped
   * away — on every page except /home, which renders its own
   * HeaderActions outside that header and so looked correct.
   *
   * jsdom computes no layout, so the height cannot be asserted here.
   * What can be asserted is the invariant the fix rests on: the dialog
   * is portalled to document.body and is therefore NOT inside the
   * component's own DOM position. Without the portal it is, and these
   * fail.
   */
  it("portals the dialog to the body, not into the trigger's wrapper", async () => {
    const user = open("/reports/bi");
    const trigger = screen.getByRole("button", { name: "Help" });
    const wrapper = trigger.parentElement!;
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Help" });
    expect(wrapper.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
  });

  it("keeps the trigger where it is", () => {
    // Only the dialog moves. Portalling the button too would take it
    // out of the header.
    open("/reports/bi");
    const trigger = screen.getByRole("button", { name: "Help" });
    expect(trigger.parentElement).not.toBe(document.body);
  });
});

describe("clicking outside", () => {
  it("closes on a click elsewhere on the page", async () => {
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does NOT close on a click inside the panel", async () => {
    // The portal means the dialog is outside the trigger's wrapper, so
    // an outside-click check written against that wrapper alone treats
    // every click in the panel — the search box included — as outside.
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.click(screen.getByLabelText("Search help"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("still lets the search box be typed into", async () => {
    const user = open("/reports/bi");
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.type(screen.getByLabelText("Search help"), "carrier");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByTestId("help-result-/reports/sim"),
    ).toBeInTheDocument();
  });
});
