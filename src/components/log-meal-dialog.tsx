"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { logCustomMeal, logMealFromLibrary } from "@/lib/actions/daily-meals";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import {
  emptyMealForm,
  formatMealMacrosSummary,
  normalizeMealMacros,
  type MealFormData,
} from "@/lib/meal-utils";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { MealPhotoLogStep } from "@/components/meal-photo-log-step";
import { MealTextLogStep } from "@/components/meal-text-log-step";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogMode = "picker" | "custom" | "library" | "photo" | "text";

const PICKER_OPTIONS = [
  {
    mode: "text" as const,
    label: "Type it",
    description: '"2 eggs and a banana" — AI parses macros',
    icon: Sparkles,
    ai: true,
  },
  {
    mode: "photo" as const,
    label: "Photo",
    description: "Snap a photo — AI fills in the details",
    icon: Camera,
    ai: true,
  },
  {
    mode: "library" as const,
    label: "From library",
    description: "Pick a saved meal or add a new one",
    icon: BookOpen,
  },
];

export function LogMealDialog({
  open,
  clientId,
  dateKey,
  library,
  hasAiAccess,
  onClose,
  onLogged,
  goal,
}: {
  open: boolean;
  clientId: string;
  dateKey: string;
  library: PersonalMealLibraryItem[];
  hasAiAccess: boolean;
  onClose: () => void;
  onLogged: (preview?: MealFormData) => void;
  goal?: string | null;
}) {
  const [mode, setMode] = useState<LogMode>("picker");
  const [customFromLibrary, setCustomFromLibrary] = useState(false);
  const [form, setForm] = useState<MealFormData>(emptyMealForm());
  const [photoReady, setPhotoReady] = useState(false);
  const [textReady, setTextReady] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setMode("picker");
    setCustomFromLibrary(false);
    setForm(emptyMealForm());
    setPhotoReady(false);
    setTextReady(false);
    setAiConfidence(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleLogCustom = () => {
    if (!form.name.trim()) {
      setError("Meal name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await logCustomMeal(clientId, dateKey, form);
      if (result.error) {
        setError(result.error);
        return;
      }
      onLogged(form);
      onClose();
    });
  };

  const handleLogFromLibrary = (mealId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await logMealFromLibrary(clientId, dateKey, mealId);
      if (result.error) {
        setError(result.error);
        return;
      }
      const item = library.find((i) => i.meal.id === mealId);
      if (item) {
        onLogged({
          meal_type: item.meal.meal_type,
          name: item.meal.name,
          description: item.meal.description ?? "",
          youtube_url: item.meal.youtube_url ?? "",
          macros: normalizeMealMacros(item.meal),
          ingredients: (item.meal.foods ?? []).map((f) => ({
            name: f.name,
            amount: f.amount ?? "",
          })),
        });
      } else {
        onLogged();
      }
      onClose();
    });
  };

  const goToMode = (next: LogMode) => {
    setMode(next);
    setError(null);
    if (next !== "custom") {
      setCustomFromLibrary(false);
    }
    if (next === "custom" || next === "photo" || next === "text") {
      setForm(emptyMealForm());
      setPhotoReady(false);
      setTextReady(false);
      setAiConfidence(null);
    }
  };

  const goToCustomFromLibrary = () => {
    setCustomFromLibrary(true);
    goToMode("custom");
  };

  const handleBack = () => {
    if (mode === "custom" && customFromLibrary) {
      setCustomFromLibrary(false);
      setMode("library");
      setError(null);
      return;
    }
    goToMode("picker");
  };

  const title =
    mode === "picker"
      ? "Log a meal"
      : mode === "custom"
        ? "New meal"
        : mode === "library"
          ? "From library"
          : mode === "text"
            ? "Type meal"
            : "Photo log";

  const showBack = mode !== "picker";
  const canLogCustom =
    mode === "custom" ||
    (mode === "photo" && hasAiAccess && photoReady) ||
    (mode === "text" && hasAiAccess && textReady);

  const logButtonLabel =
    (mode === "photo" && photoReady) || (mode === "text" && textReady)
      ? "Confirm & log meal"
      : "Log meal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log a meal"
        className="relative z-10 flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={handleBack}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h2 className="flex-1 text-lg font-black">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === "picker" && (
            <div className="grid gap-3">
              {PICKER_OPTIONS.map((option) => {
                const Icon = option.icon;
                const locked = option.ai && !hasAiAccess;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => goToMode(option.mode)}
                    className={cn(
                      "flex items-start gap-4 rounded-xl border border-border bg-secondary/30 p-4 text-left transition-colors hover:bg-secondary/60",
                      locked && "opacity-90"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                        option.ai
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{option.label}</span>
                        {option.ai && (
                          <Badge className="gap-1 bg-primary/15 text-primary">
                            <Sparkles className="h-3 w-3" />
                            AI
                          </Badge>
                        )}
                        {locked && (
                          <Badge variant="secondary">Upgrade required</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {mode === "library" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={goToCustomFromLibrary}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">New meal</p>
                  <p className="text-sm text-muted-foreground">
                    Enter name and macros manually
                  </p>
                </div>
              </button>

              {library.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No saved meals yet. Tap + above to log one with macros.
                </p>
              ) : (
                <ul className="space-y-2">
                  {library.map((item) => {
                    const summary = formatMealMacrosSummary(normalizeMealMacros(item.meal));
                    return (
                      <li
                        key={item.meal.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge className="capitalize">{item.meal.meal_type}</Badge>
                            <span className="font-semibold">{item.meal.name}</span>
                          </div>
                          {summary && (
                            <p className="text-xs text-muted-foreground">{summary}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.folderName} · {item.planTitle}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0"
                          disabled={isPending}
                          onClick={() => handleLogFromLibrary(item.meal.id)}
                        >
                          Add
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {mode === "custom" && (
            <MealDetailsFields
              mealType={form.meal_type}
              onMealTypeChange={(meal_type) => setForm((prev) => ({ ...prev, meal_type }))}
              name={form.name}
              onNameChange={(name) => setForm((prev) => ({ ...prev, name }))}
              description={form.description}
              onDescriptionChange={(description) =>
                setForm((prev) => ({ ...prev, description }))
              }
              macros={form.macros}
              onMacrosChange={(macros) => setForm((prev) => ({ ...prev, macros }))}
              ingredients={form.ingredients}
              onIngredientsChange={(ingredients) =>
                setForm((prev) => ({ ...prev, ingredients }))
              }
              autoFocusName
            />
          )}

          {mode === "photo" &&
            (hasAiAccess ? (
              <MealPhotoLogStep
                form={form}
                onFormChange={setForm}
                onError={setError}
                onReadyChange={setPhotoReady}
                confidence={aiConfidence}
                onConfidenceChange={setAiConfidence}
              />
            ) : (
              <div className="space-y-4 py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">LevelUp AI required</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upgrade to snap meal photos and let AI estimate food and macros
                    automatically.
                  </p>
                </div>
                <Link
                  href="/dashboard/pricing"
                  className={buttonVariants({ className: "w-full" })}
                  onClick={onClose}
                >
                  View AI plan
                </Link>
              </div>
            ))}

          {mode === "text" &&
            (hasAiAccess ? (
              <MealTextLogStep
                form={form}
                onFormChange={setForm}
                onError={setError}
                onReadyChange={setTextReady}
                confidence={aiConfidence}
                onConfidenceChange={setAiConfidence}
              />
            ) : (
              <div className="space-y-4 py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">LevelUp AI required</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upgrade to type meals naturally and let AI estimate macros.
                  </p>
                </div>
                <Link
                  href="/dashboard/pricing"
                  className={buttonVariants({ className: "w-full" })}
                  onClick={onClose}
                >
                  View AI plan
                </Link>
              </div>
            ))}
        </div>

        <div className="space-y-2 border-t border-border px-5 py-4">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {canLogCustom ? (
            <Button className="w-full" disabled={isPending} onClick={handleLogCustom}>
              {isPending ? "Logging…" : logButtonLabel}
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
