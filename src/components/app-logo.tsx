import Link from "next/link";
import { PLATFORM_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Split wordmark for auth cards and compact headers (e.g. RUT + INA). */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      {PLATFORM_NAME.slice(0, 3)}
      <span className="text-primary">{PLATFORM_NAME.slice(3)}</span>
    </span>
  );
}

const pillSizeStyles = {
  sm: "h-12 px-5 text-xl",
  default: "h-14 px-6 text-2xl",
  lg: "h-16 px-7 text-3xl",
} as const;

const textSizeStyles = {
  sm: "text-2xl",
  default: "text-3xl",
  lg: "text-4xl",
} as const;

export function AppLogo({
  href = "/dashboard",
  className,
  size = "default",
  variant = "pill",
}: {
  href?: string | null;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "pill" | "text";
}) {
  const label =
    variant === "text" ? (
      <span
        className={cn(
          "inline-flex items-center font-black tracking-tight uppercase text-foreground",
          textSizeStyles[size],
          className
        )}
      >
        {PLATFORM_NAME}
      </span>
    ) : (
      <span
        className={cn(
          "app-logo-badge inline-flex items-center rounded-full font-black tracking-tight uppercase text-white",
          pillSizeStyles[size],
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
