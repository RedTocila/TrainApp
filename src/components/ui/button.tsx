import { type ClassValue, clsx } from "clsx";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all touch-manipulation select-none [-webkit-tap-highlight-color:transparent] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lg shadow-primary/20 [@media(hover:hover)]:hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground border border-border [@media(hover:hover)]:hover:bg-secondary/80",
        outline:
          "border border-border bg-transparent [@media(hover:hover)]:hover:bg-secondary [@media(hover:hover)]:hover:border-primary/30",
        ghost: "[@media(hover:hover)]:hover:bg-secondary",
        destructive: "bg-red-900 text-white [@media(hover:hover)]:hover:bg-red-800",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
