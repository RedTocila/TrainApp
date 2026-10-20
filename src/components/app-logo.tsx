import Image from "next/image";
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
      <span className="text-primary">{PLATFORM_NAME.slice(0, 1)}</span>
      {PLATFORM_NAME.slice(1)}
    </span>
  );
}

/** Split wordmark for auth cards and compact headers (e.g. RUT + INA). */
export function BrandWordmark({ className }: { className?: string }) {
  return <LogoWordmark className={className} />;
}

const markSizeStyles = {
  sm: "h-7 w-auto",
  default: "h-9 w-auto",
  lg: "h-11 w-auto",
} as const;

function LogoMark({ size = "default" }: { size?: keyof typeof markSizeStyles }) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={488}
      height={609}
      className={cn("shrink-0 object-contain", markSizeStyles[size])}
    />
  );
}

export function AppLogo({
  href = "/dashboard",
  className,
  size = "default",
  variant = "wordmark",
  showMark = false,
}: {
  href?: string | null;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "wordmark" | "text";
  /** Ribbon icon beside the wordmark. */
  showMark?: boolean;
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
        <span className="text-primary">{PLATFORM_NAME.slice(0, 1)}</span>
        {PLATFORM_NAME.slice(1)}
      </span>
    ) : (
      <LogoWordmark size={size} className={className} />
    );

  const content = (
    <>
      {showMark ? <LogoMark size={size} /> : null}
      {label}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-2 rounded-sm transition-opacity hover:opacity-80"
      >
        {content}
      </Link>
    );
  }

  return <span className="inline-flex items-center gap-2">{content}</span>;
}
