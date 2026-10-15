import Image from "next/image";
import { resolveDashboardWorkoutBackground } from "@/lib/workout-visual-categories";

/** Same photo the dashboard workout card uses for this session. */
export function WorkoutTypeBanner({
  planTitle,
  dayTitle,
  planKind,
  exercises,
  gender,
  alt,
  fill = false,
}: {
  planTitle: string;
  dayTitle: string;
  planKind?: string | null;
  exercises?: { name: string }[] | null;
  gender?: "male" | "female" | null;
  alt: string;
  /** Fill a parent that is already positioned and clipped. */
  fill?: boolean;
}) {
  const src = resolveDashboardWorkoutBackground(
    { planTitle, dayTitle, planKind, exercises },
    gender === "female" ? "female" : "male"
  );

  return (
    <div
      className={
        fill
          ? "absolute inset-0 bg-zinc-900"
          : "relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-zinc-900"
      }
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(min-width: 768px) 480px, 100vw"
          className="object-cover object-[68%_42%] scale-[1.22] origin-[68%_42%]"
        />
      ) : null}
    </div>
  );
}
