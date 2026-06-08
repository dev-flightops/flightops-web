import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted spies — vi.mock factories run before top-level code, so
// router.replace etc. must come from a hoisted block.
const { replace, searchParamsString } = vi.hoisted(() => ({
  replace: vi.fn(),
  searchParamsString: { value: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dispatch",
  useSearchParams: () => ({
    toString: () => searchParamsString.value,
  }),
}));

import { RouteInput } from "./route-input";

describe("RouteInput", () => {
  beforeEach(() => {
    replace.mockReset();
    searchParamsString.value = "";
  });

  it("renders the textarea pre-filled with the default route", () => {
    render(<RouteInput defaultText={"PADU\nPANC"} />);
    const textarea = screen.getByRole("textbox", { name: /Route/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("PADU\nPANC");
  });

  it("commits parsed ICAOs to ?route= on blur", async () => {
    const user = userEvent.setup();
    render(<RouteInput defaultText="" />);

    const textarea = screen.getByRole("textbox", { name: /Route/i });
    await user.click(textarea);
    await user.type(textarea, "PAEE\nPAUN\nPAGM");
    // Blur by clicking elsewhere
    await user.tab();

    expect(replace).toHaveBeenCalled();
    const url = replace.mock.calls[0][0];
    expect(url).toContain("route=PAEE%2CPAUN%2CPAGM");
  });

  it("commits via Cmd/Ctrl-Enter without leaving the textarea via blur", async () => {
    const user = userEvent.setup();
    render(<RouteInput defaultText="" />);

    const textarea = screen.getByRole("textbox", { name: /Route/i });
    await user.click(textarea);
    await user.type(textarea, "PADU{Control>}{Enter}{/Control}");

    expect(replace).toHaveBeenCalled();
    expect(replace.mock.calls[0][0]).toContain("route=PADU");
  });

  // ---- M2-G-16: × clear button ---------------------------------------------

  it("hides the × clear button when the textarea is empty", () => {
    render(<RouteInput defaultText="" />);
    expect(
      screen.queryByRole("button", { name: /clear route/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the × clear button when the textarea has content", () => {
    render(<RouteInput defaultText="PADU" />);
    expect(
      screen.getByRole("button", { name: /clear route/i }),
    ).toBeInTheDocument();
  });

  it("clicking × clear empties the textarea AND drops ?route= from the URL", async () => {
    const user = userEvent.setup();
    // Pretend the URL already has ?route=PADU — clearing should drop it
    searchParamsString.value = "route=PADU&flight=abc";
    render(<RouteInput defaultText="PADU" />);

    await user.click(
      screen.getByRole("button", { name: /clear route/i }),
    );

    // Textarea cleared
    const textarea = screen.getByRole("textbox", { name: /Route/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");

    // URL no longer has `route=` — `flight=abc` survives
    expect(replace).toHaveBeenCalled();
    const url = replace.mock.calls[0][0];
    expect(url).not.toContain("route=");
    expect(url).toContain("flight=abc");
  });

  it("× clear hides itself after clearing (textarea is now empty)", async () => {
    const user = userEvent.setup();
    render(<RouteInput defaultText="PADU" />);

    await user.click(
      screen.getByRole("button", { name: /clear route/i }),
    );

    expect(
      screen.queryByRole("button", { name: /clear route/i }),
    ).not.toBeInTheDocument();
  });

  it("the × button has a helpful tooltip explaining the fallback behavior", () => {
    render(<RouteInput defaultText="PADU" />);
    const btn = screen.getByRole("button", { name: /clear route/i });
    expect(btn).toHaveAttribute(
      "title",
      expect.stringContaining("Weather will fall back"),
    );
  });
});
