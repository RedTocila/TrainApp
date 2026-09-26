import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "h-[var(--control-height)] w-full min-w-0 max-w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:border-border dark:bg-secondary",
        type === "time"
          ? "relative box-border block appearance-none pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:opacity-70"
          : "flex",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
