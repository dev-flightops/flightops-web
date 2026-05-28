import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["green", "yellow", "red", "blue", "gray", "orange"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: "Scheduled" },
};

export const Released: Story = {
  args: { variant: "green", children: "Released" },
};

export const InFlight: Story = {
  args: { variant: "blue", children: "Airborne" },
};

export const Cancelled: Story = {
  args: { variant: "red", children: "Cancelled" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="green">VFR</Badge>
      <Badge variant="yellow">MVFR</Badge>
      <Badge variant="red">IFR</Badge>
      <Badge variant="blue">Info</Badge>
      <Badge variant="gray">Scheduled</Badge>
      <Badge variant="orange">Warning</Badge>
    </div>
  ),
};
