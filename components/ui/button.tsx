import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// ForeFlight's buttons (#79), as components/ff/controls.ts draws them for
// links: UPPERCASE tracked labels, 3px corners, solid or outlined, no
// shadows and no lift.
//   default      → solid brand, darker on hover
//   destructive  → the destructive red, white text at 6:1 in both themes
//   outline      → the everyday secondary: a 1px frame, the label in full colour
//   secondary    → a brand-coloured frame and label
//   ghost        → words only, a ground on hover
//   link         → words in the brand's text tone, underlined on hover
const buttonVariants = cva(
  "btn-caps inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-brand-dark",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input text-foreground hover:border-foreground",
        secondary: "border border-primary/60 text-primary hover:bg-primary/10",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "normal-case tracking-normal text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[0.75rem]",
        lg: "h-10 px-5",
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
