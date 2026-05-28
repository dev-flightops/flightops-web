"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Mirrors the legacy `.label`:
//   - 0.6875rem font-size (~11px)
//   - 600 weight
//   - uppercase + heavy letter-spacing (.06em)
//   - muted color
// Combined this is the "all-caps tiny eyebrow" style used above every input
// and panel field in the legacy.
const labelVariants = cva(
  "block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground leading-none mb-1.5 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
