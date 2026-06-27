import Link from "next/link";
import { PLATFORM_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const wordmarkSizeStyles = {
  sm: "text-xl",
  default: "text-2xl",
  lg: "text-3xl",
} as const;

const textSizeStyles = {
  sm: "text-2xl",
  default: "text-3xl",
  lg: "text-4xl",
} as const;

function LogoWordmark({
  className,
  size = "default",
}: {
  className?: string;
  size?: keyof typeof wordmarkSizeStyles;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-black tracking-tight uppercase",
        wordmarkSizeStyles[size],
        className
      )}
    >
      {PLATFORM_NAME.slice(0, 3)}
      <span className="text-primary">{PLATFORM_NAME.slice(3)}</span>
    </span>
  );
}

/** Split wordmark for auth cards and compact headers (e.g. RUT + INA). */
export function BrandWordmark({ className }: { className?: string }) {
  return <LogoWordmark className={className} />;
}

export function AppLogo({
  href = "/dashboard",
  className,
  size = "default",
  variant = "wordmark",
}: {
  href?: string | null;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "wordmark" | "text";
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
      <LogoWordmark size={size} className={className} />
    );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 rounded-sm transition-opacity hover:opacity-80"
      >
        {label}
      </Link>
    );
  }

  return label;
}
