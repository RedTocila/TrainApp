import Link from "next/link";
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
    <span className={cn("font-black tracking-tight", sizeClass, className)}>
      Train<span className="text-primary">App</span>
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
