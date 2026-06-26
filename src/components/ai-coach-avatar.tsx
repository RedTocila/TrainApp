import Image from "next/image";
import { cn } from "@/lib/utils";

export const AI_COACH_AVATAR_SRC = "/ai-coach-avatar.png";

const SIZE_CLASSES = {
  xs: "h-8 w-8",
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-14 w-14",
  fab: "h-14 w-14",
} as const;

export function AiCoachAvatar({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        SIZE_CLASSES[size],
        className
      )}
    >
      <Image
        src={AI_COACH_AVATAR_SRC}
        alt="Coach Alex"
        fill
        className="object-cover object-top"
        sizes={`(max-width: 640px) 96px, 112px`}
        priority={size === "fab"}
      />
    </div>
  );
}
