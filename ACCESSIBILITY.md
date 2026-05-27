# Accessibility

We aim for **WCAG 2.0 Level A + AA** on every shipped page and component. Three layers enforce this — pick the one that fits the change you're making.

## Layer 1 — Storybook a11y panel (dev-time)

When you write a story for a component, the **Accessibility** panel in Storybook (powered by `@storybook/addon-a11y`) runs axe-core against the rendered preview and lists any violations.

- Surfaces issues immediately while iterating on a component
- Not a hard gate — `parameters.a11y.test = "todo"` in [`.storybook/preview.tsx`](.storybook/preview.tsx) keeps the story from failing the Storybook test runner
- Treat the panel as "must look clean before opening a PR"

## Layer 2 — vitest component a11y tests (CI-enforced)

Every PR runs `npm test`, which executes `*.a11y.test.tsx` files. These render a component in JSDOM and assert no axe violations via the helper in [`tests/a11y.ts`](tests/a11y.ts).

```tsx
import { expectNoA11yViolations } from "@/tests/a11y";

it("has no WCAG A/AA violations", async () => {
  const { container } = render(<MyComponent />);
  await expectNoA11yViolations(container);
});
```

The helper disables one rule by default: **`color-contrast`**, because JSDOM doesn't implement `HTMLCanvasElement.getContext` and axe needs canvas to sample pixels. Color contrast is enforced by Layer 3 instead.

**Coverage today:** Button, Card, Input/Label, FlightCard, TenantSwitcher, AppShell.

**Rule for new components:** any new reusable component in `components/` gets a paired `*.a11y.test.tsx`.

## Layer 3 — Playwright e2e a11y sweep (local / pre-merge)

[`tests/e2e/a11y.spec.ts`](tests/e2e/a11y.spec.ts) runs axe-core against every reachable page in a real Chromium browser — so `color-contrast` and other layout-aware rules are enforced here.

```bash
docker compose -f ../flightops-services/infra/docker-compose.yml up -d   # backend
npm run dev                                                              # in another terminal
npm run test:e2e -- a11y.spec.ts
```

E2E isn't in CI yet (requires the backend stack — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)). It's a local / pre-merge gate. Run it before opening a PR that adds a page or substantially changes UI.

**Coverage today:** `/login`, `/`, `/dispatch`, `/dispatch/[flightId]`, `/dashboards`, all 6 dashboard variants. Baseline as of M1-G-8 (Story 12): **all green**.

**Rule for new pages:** add the path to `PUBLIC_PAGES` or `AUTHENTICATED_PAGES` in [`tests/e2e/a11y.spec.ts`](tests/e2e/a11y.spec.ts).

## What to do when a violation appears

1. **Read the rule on Deque University** — every axe rule has a fix guide: https://dequeuniversity.com/rules/axe/
2. **Fix at the component level if possible** — the violation will then disappear everywhere the component renders.
3. **Carve-outs are rare and explicit.** If you genuinely cannot fix a rule for a single test (e.g. you're testing a third-party widget you don't control), pass `{ disabledRules: ["rule-id"] }` to `expectNoA11yViolations` and add a one-line comment naming the reason and the tracking ticket.

## Manual checks not covered by axe

axe catches about half of WCAG. For PRs that ship significant UI, run through this short list manually:

- **Keyboard navigation:** can you reach every interactive element with Tab? Can you operate it with Enter/Space?
- **Screen reader pass:** open the page in VoiceOver (Mac) or Orca (Linux) and listen through the main flow.
- **Reduced motion:** does any animation respect `prefers-reduced-motion`?
- **Zoom:** does the layout stay usable at 200% zoom?
