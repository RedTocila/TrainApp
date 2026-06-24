"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  copyMealToNewPlanInFolder,
  copyMealToPlan,
  createPersonalMeal,
  createPersonalMealInNewPlanInFolder,
  deletePersonalMeal,
  getPersonalPlansInFolderForPicker,
  updatePersonalMeal,
  type PersonalMealLibraryItem,
} from "@/lib/actions/user-nutrition";
import {
  emptyMealForm,
  formatMealMacrosSummary,
  mealFormFromMeal,
  type MealFormData,
} from "@/lib/meal-utils";
import type { MealType } from "@/lib/types";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MEAL_TYPES: { value: MealType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

function EditMealDialog({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: PersonalMealLibraryItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MealFormData>(emptyMealForm());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !item) return;
    setForm(mealFormFromMeal(item.meal));
    setError(null);
  }, [open, item]);

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

  if (!open || !item) return null;

  const handleSave = () => {
    if (!form.name.trim()) {
      setError("Meal name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePersonalMeal(item.meal.id, form);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-black">Edit meal</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MealDetailsFields
            mealType={form.meal_type}
            onMealTypeChange={(meal_type) => setForm({ ...form, meal_type })}
            name={form.name}
            onNameChange={(name) => setForm({ ...form, name })}
            description={form.description}
            onDescriptionChange={(description) => setForm({ ...form, description })}
            youtubeUrl={form.youtube_url}
            onYoutubeUrlChange={(youtube_url) => setForm({ ...form, youtube_url })}
            macros={form.macros}
            onMacrosChange={(macros) => setForm({ ...form, macros })}
            ingredients={form.ingredients}
            onIngredientsChange={(ingredients) => setForm({ ...form, ingredients })}
          />
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddMealToFolderDialog({
  item,
  folders,
  open,
  onClose,
  onDone,
}: {
  item: PersonalMealLibraryItem | null;
  folders: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<"folder" | "plan">("folder");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [plans, setPlans] = useState<{ id: string; title: string }[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setStep("folder");
    setSelectedFolderId(null);
    setPlans([]);
    setError(null);
  }, [open, item]);

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

  const selectFolder = async (folderId: string) => {
    setSelectedFolderId(folderId);
    setLoadingPlans(true);
    setError(null);
    const list = await getPersonalPlansInFolderForPicker(folderId);
    setPlans(list);
    setLoadingPlans(false);
    setStep("plan");
  };

  const handleCopyToPlan = (planId: string) => {
    if (!item) return;
    setError(null);
    startTransition(async () => {
      const result = await copyMealToPlan(item.meal.id, planId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      onDone();
      onClose();
    });
  };

  const handleNewPlan = () => {
    if (!item || !selectedFolderId) return;
    setError(null);
    startTransition(async () => {
      const result = await copyMealToNewPlanInFolder(
        item.meal.id,
        selectedFolderId
      );
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      onDone();
      onClose();
    });
  };

  if (!open || !item) return null;

  const folderName =
    folders.find((f) => f.id === selectedFolderId)?.name ?? "folder";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(85vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Add to folder
            </p>
            <h2 className="text-lg font-black">{item.meal.name}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "folder" ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Choose a folder to add this meal to.
              </p>
              <div className="space-y-2">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => selectFolder(folder.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10"
                  >
                    <span className="font-medium">{folder.name}</span>
                    {folder.id === item.folderId && (
                      <Badge variant="secondary">Current</Badge>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="mb-3 text-sm text-primary hover:underline"
                onClick={() => setStep("folder")}
              >
                ← Back to folders
              </button>
              <p className="mb-3 text-sm text-muted-foreground">
                Add a copy of this meal to a plan in {folderName}.
              </p>
              {loadingPlans ? (
                <p className="text-sm text-muted-foreground">Loading plans…</p>
              ) : (
                <div className="space-y-2">
                  {plans
                    .filter((p) => p.id !== item.planId)
                    .map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleCopyToPlan(plan.id)}
                        className="flex w-full rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left font-medium transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
                      >
                        {plan.title}
                      </button>
                    ))}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleNewPlan}
                    className="flex w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                  >
                    + New meal plan in {folderName}
                  </button>
                </div>
              )}
            </>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function CreateMealDialog({
  open,
  defaultMealType,
  folders,
  onClose,
  onSaved,
}: {
  open: boolean;
  defaultMealType: MealType;
  folders: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"details" | "folder" | "plan">("details");
  const [form, setForm] = useState<MealFormData>(emptyMealForm());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [plans, setPlans] = useState<{ id: string; title: string }[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setStep("details");
    setForm(emptyMealForm(defaultMealType));
    setSelectedFolderId(null);
    setPlans([]);
    setError(null);
  }, [open, defaultMealType]);

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

  const goToFolderStep = () => {
    if (!form.name.trim()) {
      setError("Meal name is required");
      return;
    }
    setError(null);
    setStep("folder");
  };

  const selectFolder = async (folderId: string) => {
    setSelectedFolderId(folderId);
    setLoadingPlans(true);
    setError(null);
    const list = await getPersonalPlansInFolderForPicker(folderId);
    setPlans(list);
    setLoadingPlans(false);
    setStep("plan");
  };

  const handleAddToPlan = (planId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await createPersonalMeal(planId, form);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  };

  const handleNewPlan = () => {
    if (!selectedFolderId) return;
    setError(null);
    startTransition(async () => {
      const result = await createPersonalMealInNewPlanInFolder(
        selectedFolderId,
        form
      );
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  };

  if (!open) return null;

  const folderName =
    folders.find((f) => f.id === selectedFolderId)?.name ?? "folder";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(90vh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {step === "details"
                ? "New meal"
                : step === "folder"
                  ? "Choose folder"
                  : "Choose plan"}
            </p>
            <h2 className="text-lg font-black">
              {step === "details" ? "Add meal" : form.name}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {step === "details" && (
            <MealDetailsFields
              mealType={form.meal_type}
              onMealTypeChange={(meal_type) => setForm({ ...form, meal_type })}
              name={form.name}
              onNameChange={(name) => setForm({ ...form, name })}
              description={form.description}
              onDescriptionChange={(description) => setForm({ ...form, description })}
              youtubeUrl={form.youtube_url}
              onYoutubeUrlChange={(youtube_url) => setForm({ ...form, youtube_url })}
              macros={form.macros}
              onMacrosChange={(macros) => setForm({ ...form, macros })}
              ingredients={form.ingredients}
              onIngredientsChange={(ingredients) => setForm({ ...form, ingredients })}
              autoFocusName
            />
          )}

          {step === "folder" && (
            <>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => setStep("details")}
              >
                ← Back to meal details
              </button>
              <p className="text-sm text-muted-foreground">
                Which folder should this meal live in?
              </p>
              <div className="space-y-2">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => selectFolder(folder.id)}
                    className="flex w-full rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left font-medium transition-colors hover:border-primary hover:bg-primary/10"
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "plan" && (
            <>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => setStep("folder")}
              >
                ← Back to folders
              </button>
              <p className="text-sm text-muted-foreground">
                Add to a meal plan in {folderName}, or create a new one.
              </p>
              {loadingPlans ? (
                <p className="text-sm text-muted-foreground">Loading plans…</p>
              ) : (
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAddToPlan(plan.id)}
                      className="flex w-full rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left font-medium transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                      {plan.title}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleNewPlan}
                    className="flex w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-left font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                  >
                    + New meal plan in {folderName}
                  </button>
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        {step === "details" && (
          <div className="flex gap-2 border-t border-border px-5 py-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={goToFolderStep}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MyMealsPage({
  initialMeals,
  folders,
}: {
  initialMeals: PersonalMealLibraryItem[];
  folders: { id: string; name: string }[];
}) {
  const [meals, setMeals] = useState(initialMeals);
  const [filter, setFilter] = useState<MealType | "all">("all");
  const [editItem, setEditItem] = useState<PersonalMealLibraryItem | null>(null);
  const [addItem, setAddItem] = useState<PersonalMealLibraryItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const defaultMealType: MealType =
    filter === "all" ? "breakfast" : filter;

  useEffect(() => {
    setMeals(initialMeals);
  }, [initialMeals]);

  const filtered = useMemo(() => {
    if (filter === "all") return meals;
    return meals.filter((m) => m.meal.meal_type === filter);
  }, [meals, filter]);

  const refresh = () => {
    startTransition(async () => {
      const { getPersonalMealsLibrary } = await import(
        "@/lib/actions/user-nutrition"
      );
      const fetched = await getPersonalMealsLibrary();
      setMeals(fetched);
    });
  };

  const handleDelete = (item: PersonalMealLibraryItem) => {
    if (!confirm(`Delete "${item.meal.name}"?`)) return;
    startTransition(async () => {
      const result = await deletePersonalMeal(item.meal.id);
      if (!result.error) refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                filter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add meal
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {meals.length === 0
            ? "No meals yet — tap Add meal to create your first one."
            : `No ${filter === "all" ? "" : filter + " "}meals found.`}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const macrosSummary = formatMealMacrosSummary(
              mealFormFromMeal(item.meal).macros
            );
            return (
              <li
                key={item.meal.id}
                className="rounded-lg border border-border bg-secondary/40 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="capitalize">{item.meal.meal_type}</Badge>
                      <p className="font-semibold">{item.meal.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.planTitle} · {item.folderName}
                      {macrosSummary ? ` · ${macrosSummary}` : ""}
                    </p>
                    {item.meal.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.meal.description}
                      </p>
                    )}
                    {item.meal.foods?.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                        {item.meal.foods.map((ingredient, i) => (
                          <li key={i}>
                            {ingredient.name}
                            {ingredient.amount ? ` · ${ingredient.amount}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => setAddItem(item)}
                    >
                      Add to folder
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => setEditItem(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => handleDelete(item)}
                      aria-label="Delete meal"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EditMealDialog
        item={editItem}
        open={editItem !== null}
        onClose={() => setEditItem(null)}
        onSaved={refresh}
      />

      <AddMealToFolderDialog
        item={addItem}
        folders={folders}
        open={addItem !== null}
        onClose={() => setAddItem(null)}
        onDone={refresh}
      />

      <CreateMealDialog
        open={showCreate}
        defaultMealType={defaultMealType}
        folders={folders}
        onClose={() => setShowCreate(false)}
        onSaved={refresh}
      />
    </>
  );
}
