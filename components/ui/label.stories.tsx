import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
};
export default meta;

type Story = StoryObj<typeof meta>;

export const WithInput: Story = {
  render: () => (
    <div className="grid w-[280px] gap-2">
      <Label htmlFor="tail">Tail number</Label>
      <Input id="tail" placeholder="N207GE" />
    </div>
  ),
};

export const StandaloneText: Story = {
  args: { children: "Captain" },
};
