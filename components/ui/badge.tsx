import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// The status chip: tiny uppercase label on a tint of its own colour.
//
// Used to be literal near-black backgrounds (#0a2e1a and friends) —
// right for the old dark ground, and on the light theme a dark blob with
// dark text on it. The tint pattern is theme-aware and was solved for
// contrast: every status colour reaches 4.5:1 on its own tint. The inset
// ring gives the chip an edge on white without a heavier fill.
const badgeVariants = cva(
  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.04em] leading-tight ring-1 ring-inset",
  {
    variants: {
      variant: {
        green: "bg-status-green/10 text-status-green ring-status-green/25",
        yellow: "bg-status-yellow/10 text-status-yellow ring-status-yellow/25",
        red: "bg-status-red/10 text-status-red ring-status-red/25",
        blue: "bg-status-blue/10 text-status-blue ring-status-blue/25",
        gray: "bg-status-gray/10 text-status-gray ring-status-gray/25",
        orange: "bg-status-orange/10 text-status-orange ring-status-orange/25",
      },
    },
    defaultVariants: {
      variant: "gray",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
