"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLATFORM_AI_NAME } from "@/lib/brand";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { logCustomMeal, logMealFromLibrary } from "@/lib/actions/daily-meals";
import { parseDataUrl } from "@/lib/image-compress";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import type { PersonalMealLibraryItem } from "@/lib/actions/user-nutrition";
import {
  emptyMealForm,
  formatMealMacrosSummary,
  normalizeMealMacros,
  type MealFormData,
} from "@/lib/meal-utils";
import { catalogRecipeToMealForm, type CatalogRecipe } from "@/lib/recipe-catalog";
import { buildPricingHref } from "@/lib/pricing-nav";
import { useRecipeCatalog } from "@/hooks/use-recipe-catalog";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { MealPhotoLogStep } from "@/components/meal-photo-log-step";
import { MealTextLogStep } from "@/components/meal-text-log-step";
import { AppOverlay, AppOverlayPanel } from "@/components/app-overlay";
import { usePlatformCopy } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LogMode = "picker" | "custom" | "library" | "photo" | "text";

const SAVE_TIMEOUT_MS = 45_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Meal save timed out. Please try again.")),
          ms
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

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
  const platform = usePlatformCopy();
  const pathname = usePathname();
  const [mode, setMode] = useState<LogMode>("picker");
  const [customFromLibrary, setCustomFromLibrary] = useState(false);
  const [form, setForm] = useState<MealFormData>(emptyMealForm());
  const [photoReady, setPhotoReady] = useState(false);
  const [textReady, setTextReady] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [mealPhotoDataUrl, setMealPhotoDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Controlled save flag — do not use useTransition here. Server actions that
  // revalidate paths can leave isPending stuck true (Next.js / React 19).
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const catalogActive = open && mode === "library";
  const {
    query: catalogQuery,
    setQuery: setCatalogQuery,
    recipes: catalogRecipes,
    loading: catalogLoading,
    error: catalogError,
  } = useRecipeCatalog("all", 25, catalogActive);

  useEffect(() => {
    if (!open) return;
    setMode("picker");
    setCustomFromLibrary(false);
    setForm(emptyMealForm());
    setPhotoReady(false);
    setTextReady(false);
    setAiConfidence(null);
    setMealPhotoDataUrl(null);
    setError(null);
    setIsSaving(false);
    savingRef.current = false;
  }, [open]);

  if (!open) return null;

  const pickerTopOptions = [
    {
      mode: "photo" as const,
      label: platform.mealLog.photoLog,
      description: platform.mealLog.photoDesc,
      icon: Camera,
      ai: true,
    },
    {
      mode: "library" as const,
      label: platform.mealLog.fromLibrary,
      description: platform.mealLog.fromLibraryDesc,
      icon: BookOpen,
    },
  ];

  const finishMealLog = (preview?: Parameters<typeof onLogged>[0]) => {
    try {
      onLogged(preview);
      onClose();
    } catch {
      setError(
        "Meal saved, but the screen couldn't update. Reload to see your latest log."
      );
      onClose();
    }
  };

  const beginSave = () => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    return true;
  };

  const endSave = () => {
    savingRef.current = false;
    setIsSaving(false);
  };

  const handleLogCustom = () => {
    if (!form.name.trim()) {
      setError(platform.mealLog.nameRequired);
      return;
    }
    if (!beginSave()) return;

    const photo =
      mode === "photo" && mealPhotoDataUrl
        ? (() => {
            const parsed = parseDataUrl(mealPhotoDataUrl);
            return parsed
              ? { base64: parsed.base64, mimeType: parsed.mimeType }
              : undefined;
          })()
        : undefined;

    void (async () => {
      try {
        const result = await withTimeout(
          runServerAction(() =>
            logCustomMeal(clientId, dateKey, form, photo ? { photo } : undefined)
          ),
          SAVE_TIMEOUT_MS
        );
        if (isActionError(result)) {
          setError(result.error);
          return;
        }
        finishMealLog(form);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : platform.mealLog.processFailed
        );
      } finally {
        endSave();
      }
    })();
  };

  const handleLogFromCatalog = (recipeId: string) => {
    if (!beginSave()) return;

    void (async () => {
      try {
        const res = await withTimeout(
          fetch(`/api/recipe-catalog?id=${encodeURIComponent(recipeId)}`),
          SAVE_TIMEOUT_MS
        );
        if (!res.ok) {
          setError("Recipe not found");
          return;
        }
        const data = (await res.json()) as { recipe: CatalogRecipe };
        const mealForm = catalogRecipeToMealForm(data.recipe);
        const result = await withTimeout(
          runServerAction(() => logCustomMeal(clientId, dateKey, mealForm)),
          SAVE_TIMEOUT_MS
        );
        if (isActionError(result)) {
          setError(result.error);
          return;
        }
        finishMealLog(mealForm);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : platform.mealLog.processFailed
        );
      } finally {
        endSave();
      }
    })();
  };

  const handleLogFromLibrary = (mealId: string) => {
    if (!beginSave()) return;

    void (async () => {
      try {
        const result = await withTimeout(
          runServerAction(() => logMealFromLibrary(clientId, dateKey, mealId)),
          SAVE_TIMEOUT_MS
        );
        if (isActionError(result)) {
          setError(result.error);
          return;
        }
        const item = library.find((i) => i.meal.id === mealId);
        if (item) {
          finishMealLog({
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
          finishMealLog();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : platform.mealLog.processFailed
        );
      } finally {
        endSave();
      }
    })();
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
      ? platform.mealLog.logAMeal
      : mode === "custom"
        ? platform.mealLog.newMeal
        : mode === "library"
          ? platform.mealLog.fromLibrary
          : mode === "text"
            ? platform.mealLog.typeMeal
            : platform.mealLog.photoLog;

  const showBack = mode !== "picker";
  const canLogCustom =
    mode === "custom" ||
    (mode === "photo" && hasAiAccess && photoReady) ||
    (mode === "text" && hasAiAccess && textReady) ||
    (mode === "picker" && hasAiAccess && textReady);

  const logButtonLabel = platform.mealLog.logMeal;

  const isPhotoReviewFullscreen = mode === "photo" && hasAiAccess && photoReady;

  const header = (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-2.5 sm:py-3",
        isPhotoReviewFullscreen &&
          "bg-background/95 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur-md"
      )}
    >
      {showBack ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleBack}
          disabled={isSaving}
          aria-label={platform.mealLog.goBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      ) : isPhotoReviewFullscreen ? (
        <div className="h-8 w-8 shrink-0" aria-hidden />
      ) : null}
      <h2
        className={cn(
          "min-w-0 flex-1 truncate text-base font-black sm:text-lg",
          isPhotoReviewFullscreen && "text-center"
        )}
      >
        {title}
      </h2>
      {canLogCustom && !isPhotoReviewFullscreen ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2.5 text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300"
          onClick={handleLogCustom}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {platform.common.save}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onClose}
        aria-label={platform.aria.close}
        disabled={isSaving}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  const body = (
    <>
      {mode === "picker" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {pickerTopOptions.map((option) => {
              const Icon = option.icon;
              const locked = option.ai && !hasAiAccess;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => goToMode(option.mode)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-xl border border-border bg-secondary/30 p-4 text-left transition-colors hover:bg-secondary/60",
                    locked && "opacity-90"
                  )}
                >
                  {option.ai && (
                    <Badge className="absolute right-3 top-3 gap-1 bg-primary/15 text-primary">
                      <Sparkles className="h-3 w-3" />
                      AI
                    </Badge>
                  )}
                  <div
                    className={cn(
                      "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl",
                      option.ai ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                    )}
                  >
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-semibold">{option.label}</span>
                    </div>
                    {locked && (
                      <div className="mt-2 flex items-center justify-center">
                        <Badge variant="secondary">{platform.ai.upgrade}</Badge>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-secondary/20 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{platform.mealLog.typeIt}</span>
              <Badge className="gap-1 bg-primary/15 text-primary">
                <Sparkles className="h-3 w-3" />
                AI
              </Badge>
            </div>
            {hasAiAccess ? (
              <MealTextLogStep
                form={form}
                onFormChange={setForm}
                onError={setError}
                onReadyChange={setTextReady}
                confidence={aiConfidence}
                onConfidenceChange={setAiConfidence}
                compact
              />
            ) : (
              <div className="space-y-3 text-center">
                <Link
                  href={buildPricingHref(pathname)}
                  className={buttonVariants({ className: "w-full" })}
                  onClick={onClose}
                >
                  View AI plan
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

          {mode === "library" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder="Search 13k recipes…"
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={goToCustomFromLibrary}
                  aria-label={platform.mealLog.newMeal}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {catalogLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading recipes…
                </div>
              ) : catalogError ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{catalogError}</p>
              ) : catalogRecipes.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No recipes match your search.
                </p>
              ) : (
                <ul className="max-h-[min(50vh,28rem)] space-y-2 overflow-y-auto">
                  {catalogRecipes.map((recipe) => (
                    <li
                      key={recipe.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3"
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge className="capitalize">{recipe.meal_type}</Badge>
                          <span className="font-semibold">{recipe.title}</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {recipe.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={isSaving}
                        onClick={() => handleLogFromCatalog(recipe.id)}
                      >
                        {isSaving ? platform.common.saving : platform.mealLog.logMeal}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {library.length > 0 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Your saved meals
                  </p>
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
                            disabled={isSaving}
                            onClick={() => handleLogFromLibrary(item.meal.id)}
                          >
                            {isSaving ? platform.common.saving : platform.common.add}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
                onPhotoDataUrlChange={setMealPhotoDataUrl}
                confidence={aiConfidence}
                onConfidenceChange={setAiConfidence}
                onSave={handleLogCustom}
                isSaving={isSaving}
              />
            ) : (
              <div className="space-y-4 py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{PLATFORM_AI_NAME} required</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upgrade to snap meal photos and let AI estimate food and macros
                    automatically.
                  </p>
                </div>
                <Link
                  href={buildPricingHref(pathname)}
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
                  <p className="font-semibold">{PLATFORM_AI_NAME} required</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Upgrade to type meals naturally and let AI estimate macros.
                  </p>
                </div>
                <Link
                  href={buildPricingHref(pathname)}
                  className={buttonVariants({ className: "w-full" })}
                  onClick={onClose}
                >
                  View AI plan
                </Link>
              </div>
            ))}
    </>
  );

  const footerActions =
    canLogCustom || mode !== "picker" || error ? (
      <div className="mt-4 space-y-2 border-t border-border pt-4 pb-1">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {canLogCustom ? (
          <Button className="w-full" disabled={isSaving} onClick={handleLogCustom}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {platform.common.saving}
              </>
            ) : (
              logButtonLabel
            )}
          </Button>
        ) : mode !== "picker" ? (
          <Button variant="outline" className="w-full" onClick={onClose} disabled={isSaving}>
            {platform.common.close}
          </Button>
        ) : null}
      </div>
    ) : null;

  return (
    <AppOverlay
      open={open}
      onClose={() => {
        if (!savingRef.current) onClose();
      }}
      fullscreen={isPhotoReviewFullscreen}
      closeOnBackdrop={!isSaving}
    >
      <AppOverlayPanel
        fullscreen={isPhotoReviewFullscreen}
        showHandle={!isPhotoReviewFullscreen}
        maxWidth="max-w-lg"
        aria-label={
          isPhotoReviewFullscreen ? platform.mealLog.photoLog : platform.mealLog.logAMeal
        }
        className={cn(
          !isPhotoReviewFullscreen && "max-h-[min(92%,48rem)]"
        )}
      >
        {header}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain",
            isPhotoReviewFullscreen
              ? "px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
              : "px-5 py-4"
          )}
          data-scroll-lock-scrollable
        >
          <div className={cn(isPhotoReviewFullscreen && "mx-auto w-full max-w-lg")}>
            {body}
            {footerActions}
          </div>
        </div>
      </AppOverlayPanel>
    </AppOverlay>
  );
}
