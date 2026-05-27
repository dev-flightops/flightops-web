import type { Meta, StoryObj } from "@storybook/react";
import { Plane } from "lucide-react";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  args: { children: "Dispatch flight" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Cancel release" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Link: Story = { args: { variant: "link" } };

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plane className="h-4 w-4" />
        Release dispatch
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: { size: "icon", children: <Plane className="h-4 w-4" />, "aria-label": "Dispatch" },
};
