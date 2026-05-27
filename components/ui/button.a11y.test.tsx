import { render } from "@testing-library/react";
import { describe, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { Button } from "./button";

describe("Button (a11y)", () => {
  it("has no WCAG 2 A/AA violations in the default state", async () => {
    const { container } = render(<Button>Release dispatch</Button>);
    await expectNoA11yViolations(container);
  });

  it("has no violations when disabled", async () => {
    const { container } = render(<Button disabled>Cannot release</Button>);
    await expectNoA11yViolations(container);
  });

  it("destructive variant still passes", async () => {
    const { container } = render(
      <Button variant="destructive">Cancel flight</Button>,
    );
    await expectNoA11yViolations(container);
  });
});
