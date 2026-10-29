import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AppLoading from "./loading";

describe("the in-app loading state (#142)", () => {
  it("says the page is loading, with the app's spinner", () => {
    const { container } = render(<AppLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(container.querySelector("svg")).toHaveClass("motion-safe:animate-spin");
  });
});
