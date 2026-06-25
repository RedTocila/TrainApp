import Image from "next/image";
import { cn } from "@/lib/utils";

export const AI_COACH_AVATAR_SRC = "/ai-coach-avatar.png";

export function AiCoachAvatar({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md" | "lg" | "fab";
  className?: string;
}) {
  const dimension =
    size === "xs"
      ? 32
      : size === "sm"
        ? 36
        : size === "md"
          ? 48
          : size === "lg"
            ? 56
            : 56;

  return (
    <Image
      src={AI_COACH_AVATAR_SRC}
      alt="AI Coach"
      width={dimension}
      height={dimension}
      className={cn("rounded-full object-cover", className)}
      sizes={`${dimension}px`}
      priority={size === "fab"}
    />
  );
}
