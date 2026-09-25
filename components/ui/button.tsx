import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Variant palette mirrors the legacy `.btn-*` classes:
//   default      → `.btn-primary`   (iOS-blue fill, subtle shadow on hover)
//   destructive  → `.btn-danger`    (dark-red fill, lighter text)
//   secondary    → `.btn-secondary` (translucent panel bg + border)
//   outline      → outlined variant of secondary
//   ghost        → text-only with hover bg
//   link         → underline-on-hover text-only
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[0.8125rem] font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // The home page's "Call ops": solid brand, DARKER on hover, and
        // no lift — the home cards were built "no lift so the layout
        // stays rock-solid during pointer movement", and a button that
        // hops under the cursor is the same problem.
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-brand-dark",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // Neutral bordered — the everyday secondary action.
        outline:
          "border border-input bg-background text-foreground shadow-sm hover:bg-accent",
        // The home page's secondary: brand outline on white.
        secondary:
          "border border-primary/40 bg-background text-primary hover:bg-primary/5",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5 text-[0.8125rem]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
