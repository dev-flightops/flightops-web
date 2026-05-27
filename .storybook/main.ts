import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-themes"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
};

export default config;
