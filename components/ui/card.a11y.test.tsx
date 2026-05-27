import { render } from "@testing-library/react";
import { describe, it } from "vitest";

import { expectNoA11yViolations } from "@/tests/a11y";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

describe("Card (a11y)", () => {
  it("composed card has no WCAG A/AA violations", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s ops</CardTitle>
          <CardDescription>Three flights scheduled</CardDescription>
        </CardHeader>
        <CardContent>
          <p>GV101 · GV103 · GV205</p>
        </CardContent>
      </Card>,
    );
    await expectNoA11yViolations(container);
  });
});
