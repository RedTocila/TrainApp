import Link from "next/link";
import { PLATFORM_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function AppLogo({
  href = "/dashboard",
  className,
  size = "default",
}: {
  href?: string | null;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const sizeClass = {
    sm: "text-base",
    default: "text-xl",
    lg: "text-2xl",
  }[size];

  const label = (
    <span className={cn("font-black tracking-tight uppercase", sizeClass, className)}>
      {PLATFORM_NAME.slice(0, 3)}
      <span className="text-primary">{PLATFORM_NAME.slice(3)}</span>
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
