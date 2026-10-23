import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isAppPath, RichText } from "./rich-text";

/**
 * The formatting help text and the assistant's answers use (#114), and
 * nothing more: an answer can't send someone off the site or put markup
 * on the page.
 */
describe("RichText", () => {
  it("renders paragraphs, numbered and bulleted lists, and bold", () => {
    const { container } = render(
      <RichText
        text={"Open the packet.\n\n1. Pick the PIC.\n2. Press **Generate PDF**.\n\n- One\n- Two"}
      />,
    );
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(screen.getByText("Generate PDF").tagName).toBe("STRONG");
  });

  it("links pages in the app, and only those", () => {
    render(
      <RichText
        text={
          "See [Dispatch](/dispatch), [the FAQ](/help#faq-release-refused), " +
          "[elsewhere](https://evil.example), [here](//evil.example) and [this](javascript:alert(1))."
        }
      />,
    );
    expect(screen.getByRole("link", { name: "Dispatch" })).toHaveAttribute("href", "/dispatch");
    expect(screen.getByRole("link", { name: "the FAQ" })).toHaveAttribute(
      "href",
      "/help#faq-release-refused",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText(/elsewhere, here and this/)).toBeInTheDocument();
  });

  it("shows markup as text, and headings and code as plain words", () => {
    const { container } = render(
      <RichText text={"### Steps\n<script>alert(1)</script> and `Release`"} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("Steps").tagName).toBe("STRONG");
    expect(screen.getByText("<script>alert(1)</script> and Release")).toBeInTheDocument();
  });

  it("knows a path in the app from anything else", () => {
    expect(isAppPath("/dispatch")).toBe(true);
    expect(isAppPath("//evil.example")).toBe(false);
    expect(isAppPath("/\\evil.example")).toBe(false);
    expect(isAppPath("https://evil.example")).toBe(false);
  });
});

describe("numbered lists the answer interrupts", () => {
  it("go on from their own number", () => {
    const { container } = render(
      <RichText text={"1. Open it.\n2. Check in.\n- a point\n3. Board."} />,
    );
    const lists = container.querySelectorAll("ol");
    expect(lists).toHaveLength(2);
    expect(lists[0]).not.toHaveAttribute("start");
    expect(lists[1]).toHaveAttribute("start", "3");
  });
});
