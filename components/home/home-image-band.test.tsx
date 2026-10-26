import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeImageBand } from "./home-image-band";

describe("the company's image behind Home (#118)", () => {
  it("draws the greeting over the image, under a scrim, dark in both modes", () => {
    const { container } = render(
      <HomeImageBand src="https://cdn.brand.example/hero.jpg">
        <h1>Good morning, Dana</h1>
      </HomeImageBand>,
    );
    const band = container.querySelector("section")!;
    expect(band).toHaveClass("dark");
    expect(band.querySelector('img[src="https://cdn.brand.example/hero.jpg"]')).toHaveAttribute("alt", "");
    expect(band.querySelector('[aria-hidden="true"]')).toHaveClass("bg-gradient-to-t");
    expect(screen.getByRole("heading", { name: "Good morning, Dana" })).toBeInTheDocument();
  });
});
