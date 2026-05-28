import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Mirrors the legacy `.badge-*` family:
//   - tiny 0.65rem font
//   - dark-tinted background paired with a bright variant color
//   - uppercase + heavy tracking + bold weight
//   - 6px corner radius
//
// Backgrounds use literal hex (not Tailwind status-* tokens) because they're
// always darker than the corresponding text color — they form a dual palette
// that doesn't reduce cleanly to a single token per variant.
const badgeVariants = cva(
  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.04em] leading-tight",
  {
    variants: {
      variant: {
        green: "bg-[#0a2e1a] text-status-green",
        yellow: "bg-[#2e2000] text-status-yellow",
        red: "bg-[#2e0808] text-status-red",
        blue: "bg-[#081a2e] text-status-blue",
        gray: "bg-[#1a2535] text-status-gray",
        orange: "bg-[#2e1800] text-status-orange",
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
