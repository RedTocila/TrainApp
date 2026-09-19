"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hammer, Sparkles } from "lucide-react";
import { AppOverlay } from "@/components/app-overlay";
import { AddNutritionWizard } from "@/components/add-nutrition-wizard";
import { usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { UNCATEGORIZED_NUTRITION_FOLDER_ID } from "@/lib/nutrition-folders";
import { cn } from "@/lib/utils";

export function BuildNutritionButton({
  className,
  folderId = UNCATEGORIZED_NUTRITION_FOLDER_ID,
  size = "sm",
}: {
  className?: string;
  folderId?: string;
  size?: "sm" | "default";
}) {
  const platform = usePlatformCopy();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const closePicker = () => setPickerOpen(false);

  const options = [
    {
      id: "ai" as const,
      label: platform.nutrition.buildWithAi,
      icon: Sparkles,
      accent: "text-emerald-400",
      onSelect: () => {
        closePicker();
        router.push("/dashboard/ai/plans/nutrition");
      },
    },
    {
      id: "manual" as const,
      label: platform.nutrition.buildManually,
      icon: Hammer,
      accent: "text-foreground",
      onSelect: () => {
        closePicker();
        setWizardOpen(true);
      },
    },
  ];

  return (
    <>
      <Button
        type="button"
        size={size}
        variant="outline"
        className={cn(
          "h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs font-black tracking-[0.12em]",
          className
        )}
        onClick={() => setPickerOpen(true)}
        aria-label={platform.nutrition.buildCta}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {platform.nutrition.buildCta}
      </Button>

      <AppOverlay open={pickerOpen} onClose={closePicker} presentation="center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={platform.nutrition.buildCta}
          className="relative z-10 w-full max-w-sm px-4"
        >
          <div className="grid grid-cols-2 gap-8">
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={option.onSelect}
                  className="flex flex-col items-center gap-3 transition-transform duration-200 active:scale-95"
                >
                  <Icon
                    className={cn("h-12 w-12", option.accent)}
                    strokeWidth={1.75}
                  />
                  <span className="text-center text-sm font-bold leading-tight text-foreground">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </AppOverlay>

      <AddNutritionWizard
        open={wizardOpen}
        folderId={folderId}
        onClose={() => setWizardOpen(false)}
        onComplete={() => {
          setWizardOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
