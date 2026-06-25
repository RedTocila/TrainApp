import Link from "next/link";
import { PLATFORM_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const sizeStyles = {
  sm: {
    text: "text-base",
    box: "rounded-lg px-2.5 py-1",
  },
  default: {
    text: "text-xl",
    box: "rounded-lg px-3 py-1.5",
  },
  lg: {
    text: "text-2xl",
    box: "rounded-lg px-4 py-2",
  },
} as const;

export function AppLogo({
  href = "/dashboard",
  className,
  size = "default",
}: {
  href?: string | null;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const styles = sizeStyles[size];

  const label = (
    <span
      className={cn(
        "app-logo-badge inline-flex items-center font-black tracking-tight uppercase text-white",
        styles.text,
        styles.box,
        className
      )}
    >
      {PLATFORM_NAME}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {label}
      </Link>
    );
  }

  return label;
}
