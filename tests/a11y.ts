/**
 * Component-level accessibility helpers for vitest + RTL.
 *
 * Usage:
 *   import { expectNoA11yViolations } from "@/tests/a11y";
 *   const { container } = render(<MyComponent />);
 *   await expectNoA11yViolations(container);
 *
 * The check runs WCAG 2.0 A + AA rules — the same tag set Playwright uses for
 * page-level scans, so a component that passes here is consistent with what
 * the e2e suite enforces.
 *
 * If you legitimately need to allow a rule for a specific component (e.g. a
 * colour-contrast issue that lives in shared CSS and is fixed elsewhere),
 * pass `{ disabledRules: ["color-contrast"] }` and add a comment explaining
 * the carve-out so it's reviewable.
 */

import axe from "axe-core";
import type { AxeResults, RunOptions } from "axe-core";
import { expect } from "vitest";

interface Options {
  disabledRules?: string[];
}

// Rules that can't run accurately in jsdom (no real layout, no canvas) and
// must instead be enforced by Playwright against a real browser. Keeping the
// list small + named so reviewers know exactly what's deferred and where.
const JSDOM_UNSUPPORTED_RULES = [
  // axe needs HTMLCanvasElement.getContext to sample pixels; jsdom stubs it.
  "color-contrast",
];

export async function runA11y(
  container: Element,
  { disabledRules = [] }: Options = {},
): Promise<AxeResults> {
  const allDisabled = [...JSDOM_UNSUPPORTED_RULES, ...disabledRules];
  const runOptions: RunOptions = {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    rules: Object.fromEntries(
      allDisabled.map((id) => [id, { enabled: false }]),
    ),
  };
  // axe-core's first overload accepts a context + options
  return axe.run(container, runOptions);
}

export async function expectNoA11yViolations(
  container: Element,
  options: Options = {},
): Promise<void> {
  const results = await runA11y(container, options);
  if (results.violations.length === 0) return;

  // Build a readable error message that names each violated rule and the
  // first node it found — much easier than scrolling through the raw object.
  const summary = results.violations
    .map((v) => {
      const node = v.nodes[0]?.html ?? "";
      return `  • ${v.id} (${v.impact}): ${v.help}\n      ${node}`;
    })
    .join("\n");
  expect.fail(
    `${results.violations.length} a11y violation(s) found:\n${summary}\n\nSee https://dequeuniversity.com/rules/axe/ for fix guidance.`,
  );
}
