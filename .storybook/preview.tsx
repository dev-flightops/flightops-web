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
  },
  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "dark",
    }),
  ],
};

export default preview;
