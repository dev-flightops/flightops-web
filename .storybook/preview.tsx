import type { Preview } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";

import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    a11y: {
      // Same WCAG tag set as vitest + Playwright — keep all three in sync.
      config: { rules: [] },
      options: { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } },
      // "todo" surfaces violations in the panel without failing the story —
      // dev-time guidance, not a hard gate. CI gating is vitest + Playwright.
      test: "todo",
    },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "dark",
    }),
  ],
};

export default preview;
