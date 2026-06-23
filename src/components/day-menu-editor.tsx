"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addLibraryMealToSlot,
  addMealToDayMenuSlot,
  deletePersonalMeal,
  reorderSlotMeals,
  updateDayMenuDetails,
  updatePersonalMeal,
  type PersonalMealLibraryItem,
} from "@/lib/actions/user-nutrition";
import { MealDetailsFields } from "@/components/meal-details-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  emptyMealForm,
  formatMealMacrosSummary,
  mealFormFromMeal,
  type MealFormData,
} from "@/lib/meal-utils";
import {
  MEAL_SLOTS,
  groupMealsBySlot,
  sumDayMenuMacros,
  type MealSlot,
} from "@/lib/meal-slots";
import { formatMealSlotWindow } from "@/lib/meal-times";
import type { Meal, NutritionPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

function MealEditDialog({
  meal,
  open,
  onClose,
  onSaved,
}: {
  meal: Meal | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MealFormData>(emptyMealForm());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && meal) setForm(mealFormFromMeal(meal));
  }, [open, meal]);

  if (!open || !meal) return null;

  const handleSave = () => {
    if (!form.name.trim()) {
      setError("Meal name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePersonalMeal(meal.id, form);
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
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-black">Edit meal</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <MealDetailsFields
            mealType={form.meal_type}
            onMealTypeChange={(meal_type) => setForm({ ...form, meal_type })}
            name={form.name}
            onNameChange={(name) => setForm({ ...form, name })}
            description={form.description}
            onDescriptionChange={(description) => setForm({ ...form, description })}
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

function AddMealDialog({
  slot,
  open,
  mealLibrary,
  onClose,
  onAddNew,
  onAddFromLibrary,
}: {
  slot: MealSlot;
  open: boolean;
  mealLibrary: PersonalMealLibraryItem[];
  onClose: () => void;
  onAddNew: (data: MealFormData) => void;
  onAddFromLibrary: (mealId: string) => void;
}) {
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [form, setForm] = useState<MealFormData>(() => ({
    ...emptyMealForm(MEAL_SLOTS.find((s) => s.slot === slot)!.meal_type),
  }));
  const slotMeta = MEAL_SLOTS.find((s) => s.slot === slot)!;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(85vh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Add to {slotMeta.label}
          </p>
          <h2 className="text-lg font-black">Add meal</h2>
        </div>
        <div className="flex gap-2 border-b border-border px-5 py-2">
          <Button
            size="sm"
            variant={mode === "pick" ? "default" : "outline"}
            onClick={() => setMode("pick")}
          >
            From library
          </Button>
          <Button
            size="sm"
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => setMode("new")}
          >
            Create new
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === "pick" ? (
            <div className="space-y-2">
              {mealLibrary.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No meals in your library yet — create one instead.
                </p>
              ) : (
                mealLibrary.map((item) => (
                  <button
                    key={item.meal.id}
                    type="button"
                    onClick={() => onAddFromLibrary(item.meal.id)}
                    className="flex w-full flex-col rounded-lg border border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/10"
                  >
                    <span className="font-medium">{item.meal.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.folderName} · {item.planTitle}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <MealDetailsFields
              mealType={form.meal_type}
              onMealTypeChange={() => {}}
              name={form.name}
              onNameChange={(name) => setForm({ ...form, name })}
              description={form.description}
              onDescriptionChange={(description) => setForm({ ...form, description })}
              macros={form.macros}
              onMacrosChange={(macros) => setForm({ ...form, macros })}
              ingredients={form.ingredients}
              onIngredientsChange={(ingredients) => setForm({ ...form, ingredients })}
              autoFocusName
            />
          )}
        </div>
        {mode === "new" && (
          <div className="flex gap-2 border-t border-border px-5 py-4">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (!form.name.trim()) return;
                onAddNew(form);
              }}
            >
              Add meal
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DayMenuEditor({
  plan,
  meals,
  mealLibrary,
  onSaved,
}: {
  plan: NutritionPlan;
  meals: Meal[];
  mealLibrary: PersonalMealLibraryItem[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description ?? "");
  const [addSlot, setAddSlot] = useState<MealSlot | null>(null);
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => groupMealsBySlot(meals), [meals]);
  const totals = useMemo(() => sumDayMenuMacros(meals), [meals]);

  const handleSaveDetails = () => {
    if (!title.trim()) {
      setError("Day menu name is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateDayMenuDetails(plan.id, { title, description });
      if (result.error) setError(result.error);
      else onSaved();
    });
  };

  const handleMove = (slot: MealSlot, mealId: string, direction: -1 | 1) => {
    const queue = grouped[slot];
    const idx = queue.findIndex((m) => m.id === mealId);
    if (idx < 0) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= queue.length) return;

    const ordered = [...queue];
    [ordered[idx], ordered[nextIdx]] = [ordered[nextIdx], ordered[idx]];

    startTransition(async () => {
      await reorderSlotMeals(
        plan.id,
        slot,
        ordered.map((m) => m.id)
      );
      onSaved();
    });
  };

  const handleRemove = (mealId: string) => {
    startTransition(async () => {
      await deletePersonalMeal(mealId);
      onSaved();
    });
  };

  const handleAddNew = (slot: MealSlot, data: MealFormData) => {
    startTransition(async () => {
      const result = await addMealToDayMenuSlot(plan.id, slot, data);
      if (!("error" in result && result.error)) {
        setAddSlot(null);
        onSaved();
      }
    });
  };

  const handleAddFromLibrary = (slot: MealSlot, mealId: string) => {
    startTransition(async () => {
      const result = await addLibraryMealToSlot(plan.id, slot, mealId);
      if (!("error" in result && result.error)) {
        setAddSlot(null);
        onSaved();
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Day menu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Weight loss day, high protein"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{totals.calories} cal</Badge>
            <Badge variant="outline">{totals.protein}g protein</Badge>
            <Badge variant="outline">{totals.carbs}g carbs</Badge>
            <Badge variant="outline">{totals.fat}g fat</Badge>
          </div>
          <Button size="sm" disabled={isPending} onClick={handleSaveDetails}>
            Save details
          </Button>
        </CardContent>
      </Card>

      {MEAL_SLOTS.map(({ slot, label }) => {
        const queue = grouped[slot];
        return (
          <Card key={slot}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <CardTitle className="text-base">
                {label}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {formatMealSlotWindow(slot)}
                </span>
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddSlot(slot)}>
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No meals queued — add one from your library or create new.
                </p>
              ) : (
                queue.map((meal, idx) => {
                  const macros = formatMealMacrosSummary(mealFormFromMeal(meal).macros);
                  return (
                    <div
                      key={meal.id}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-3",
                        idx === 0 && "border-primary/40 bg-primary/5"
                      )}
                    >
                      <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {idx === 0 && (
                            <Badge className="bg-primary/15 text-primary text-xs">
                              Up next
                            </Badge>
                          )}
                          <p className="font-medium">{meal.name}</p>
                        </div>
                        {macros && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{macros}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isPending || idx === 0}
                          onClick={() => handleMove(slot, meal.id, -1)}
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isPending || idx === queue.length - 1}
                          onClick={() => handleMove(slot, meal.id, 1)}
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditMeal(meal)}
                          aria-label="Edit meal"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isPending}
                          onClick={() => handleRemove(meal.id)}
                          aria-label="Remove meal"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <AddMealDialog
        slot={addSlot ?? "breakfast"}
        open={addSlot !== null}
        mealLibrary={mealLibrary}
        onClose={() => setAddSlot(null)}
        onAddNew={(data) => addSlot && handleAddNew(addSlot, data)}
        onAddFromLibrary={(mealId) => addSlot && handleAddFromLibrary(addSlot, mealId)}
      />

      <MealEditDialog
        meal={editMeal}
        open={editMeal !== null}
        onClose={() => setEditMeal(null)}
        onSaved={onSaved}
      />
    </div>
  );
}
