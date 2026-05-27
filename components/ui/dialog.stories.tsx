import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
};
export default meta;

type Story = StoryObj<typeof meta>;

export const ConfirmRelease: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Release dispatch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release N207GE for DUT → ANC?</DialogTitle>
          <DialogDescription>
            All compliance checks have passed. This will lock the flight plan and notify
            the crew.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Release</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit crew</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign crew</DialogTitle>
          <DialogDescription>Captain and First Officer for this leg.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="captain">Captain</Label>
            <Input id="captain" placeholder="Type to search…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fo">First Officer</Label>
            <Input id="fo" placeholder="Type to search…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
