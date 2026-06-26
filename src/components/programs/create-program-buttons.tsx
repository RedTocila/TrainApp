"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AddWorkoutWizard } from "@/components/add-workout-wizard";
import { AddNutritionWizard } from "@/components/add-nutrition-wizard";
import { Button } from "@/components/ui/button";
import { UNCATEGORIZED_NUTRITION_FOLDER_ID } from "@/lib/nutrition-folders";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/workout-folders";
import { cn } from "@/lib/utils";

export function CreateWorkoutButton({
  className,
  size = "sm",
  variant = "default",
  label = "New workout",
  iconOnly = false,
}: {
  className?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost";
  label?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size={iconOnly ? "icon" : size}
        variant={variant}
        className={cn(iconOnly && "h-9 w-9 shrink-0", className)}
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? label || "New workout" : undefined}
      >
        <Plus className={cn("h-4 w-4", !iconOnly && label && "mr-1.5")} />
        {!iconOnly && label}
      </Button>
      <AddWorkoutWizard
        open={open}
        folderId={UNCATEGORIZED_FOLDER_ID}
        onClose={() => setOpen(false)}
        onComplete={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

export function CreateMealPlanButton({
  className,
  size = "sm",
  variant = "default",
  label = "New day menu",
  iconOnly = false,
}: {
  className?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost";
  label?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size={iconOnly ? "icon" : size}
        variant={variant}
        className={cn(iconOnly && "h-9 w-9 shrink-0", className)}
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? label || "New day menu" : undefined}
      >
        <Plus className={cn("h-4 w-4", !iconOnly && label && "mr-1.5")} />
        {!iconOnly && label}
      </Button>
      <AddNutritionWizard
        open={open}
        folderId={UNCATEGORIZED_NUTRITION_FOLDER_ID}
        onClose={() => setOpen(false)}
        onComplete={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
