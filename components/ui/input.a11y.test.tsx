import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import { Input } from "./input";
import { Label } from "./label";

describe("Input + Label (a11y)", () => {
  it("labelled input has no violations", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  // Regression sanity check: an Input without a label OR aria-label is a
  // real a11y violation. Asserting the rule fires here documents that we
  // rely on axe to catch it if someone removes the <Label> wrapper.
  it("unlabelled input does trip the label rule", async () => {
    const { container } = render(<Input type="text" />);
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    const ruleIds = results.violations.map((v) => v.id);
    expect(ruleIds).toContain("label");
  });
});
