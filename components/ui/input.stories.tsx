import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  argTypes: {
    type: { control: "select", options: ["text", "email", "password", "number"] },
    disabled: { control: "boolean" },
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { placeholder: "Tail number (e.g. N207GE)" } };
export const Email: Story = { args: { type: "email", placeholder: "you@example.com" } };
export const Password: Story = { args: { type: "password", placeholder: "Password" } };
export const Disabled: Story = { args: { placeholder: "Disabled", disabled: true } };
export const WithValue: Story = { args: { defaultValue: "N207GE" } };
