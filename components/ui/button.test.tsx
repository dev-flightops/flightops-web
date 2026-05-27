import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Release dispatch</Button>);
    expect(screen.getByRole("button", { name: "Release dispatch" })).toBeInTheDocument();
  });

  it("applies the default variant classes", () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-primary");
  });

  it("applies destructive variant classes", () => {
    render(<Button variant="destructive">Cancel</Button>);
    expect(screen.getByRole("button").className).toContain("bg-destructive");
  });

  it("applies size classes", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button").className).toContain("h-9");
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Disabled
      </Button>,
    );

    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
