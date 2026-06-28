import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bathroom scale — square platform with analog dial (Lucide stroke style). */
export const ElectronicScale = forwardRef<
  SVGSVGElement,
  React.ComponentPropsWithoutRef<"svg">
>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("lucide lucide-electronic-scale", className)}
    {...props}
  >
    <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    <path d="M9 10h6" />
    <path d="M9 10a3 3 0 0 1 6 0" />
    <path d="M12 10 13.3 8.1" />
    <path d="M8.4 10 9.1 10" />
    <path d="M9.6 8.1 10.2 8.7" />
    <path d="M12 7.2 12 7.9" />
    <path d="M15.6 10 14.9 10" />
  </svg>
)) as LucideIcon;

ElectronicScale.displayName = "ElectronicScale";
