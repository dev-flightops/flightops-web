import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof meta>;

export const FlightSummary: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>N207GE — DUT → ANC</CardTitle>
        <CardDescription>Caravan · 8 PAX · 1240 lbs cargo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          <div>STD: 14:30 AKT</div>
          <div>ETA: 16:12 AKT</div>
          <div className="text-muted-foreground">Captain: Solberg · F/O: Choi</div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Release</Button>
        <Button size="sm" variant="outline">
          Details
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const Empty: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Empty card</CardTitle>
        <CardDescription>No content yet</CardDescription>
      </CardHeader>
    </Card>
  ),
};
