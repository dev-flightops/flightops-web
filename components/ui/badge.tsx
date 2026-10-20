import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A status, said quietly (#79): the word in capitals in its status colour
// behind a small square marker, as components/ff/status-mark.tsx draws it.
// It replaces the tinted chip (the client's brief rules out pill badges).
// Each status colour is solved for 4.5:1 on every ground it sits on.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap text-[0.68rem] font-bold uppercase leading-tight tracking-[0.1em]",
  {
    variants: {
      variant: {
        green: "text-status-green",
        yellow: "text-status-yellow",
        red: "text-status-red",
        blue: "text-status-blue",
        gray: "text-status-gray",
        orange: "text-status-orange",
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

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      <span aria-hidden className="h-1.5 w-1.5 flex-shrink-0 bg-current" />
      {children}
    </span>
  );
}

export { badgeVariants };
