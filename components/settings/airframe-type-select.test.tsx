import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AIRFRAME_TYPES, AirframeTypeSelect } from "./airframe-type-select";

describe("AirframeTypeSelect", () => {
  it("offers the types in words, the aircraft's own chosen", () => {
    render(<AirframeTypeSelect defaultValue="1900d" />);
    const select = screen.getByLabelText("Airframe type");
    expect(select).toHaveValue("1900d");
    expect(screen.getByRole("option", { name: "Beechcraft 1900D" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(AIRFRAME_TYPES.length + 1);
  });

  it("keeps a type the list doesn't know, rather than blanking it on save", () => {
    render(<AirframeTypeSelect defaultValue="otter" />);
    expect(screen.getByLabelText("Airframe type")).toHaveValue("otter");
  });

  it("starts at Not set on a new aircraft", () => {
    render(<AirframeTypeSelect optional />);
    expect(screen.getByLabelText("Airframe type (optional)")).toHaveValue("");
  });
});
