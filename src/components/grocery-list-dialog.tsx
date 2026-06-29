"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ShoppingCart, X } from "lucide-react";
import {
  getGroceryChecks,
  getWeeklyGroceryList,
  toggleGroceryCheck,
} from "@/lib/actions/grocery-list";
import { groupGroceryByCategory } from "@/lib/grocery-list-utils";
import { isActionError, runServerAction } from "@/lib/run-server-action";
import { usePlatformCopy } from "@/components/locale-provider";
import type { GroceryListItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GroceryListDialog({
  open,
  clientId,
  planId,
  onClose,
}: {
  open: boolean;
  clientId: string;
  planId: string;
  onClose: () => void;
}) {
  const platform = usePlatformCopy();
  const [items, setItems] = useState<GroceryListItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [weekKey, setWeekKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listResult = await getWeeklyGroceryList(clientId, planId);
      if ("error" in listResult) {
        setError(listResult.error);
        setItems([]);
        return;
      }
      const checks = await getGroceryChecks(clientId, planId, listResult.weekKey);
      setItems(listResult.items);
      setWeekKey(listResult.weekKey);
      setCheckedIds(new Set(checks));
    } finally {
      setLoading(false);
    }
  }, [clientId, planId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

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

  const grouped = useMemo(() => groupGroceryByCategory(items), [items]);
  const boughtCount = items.filter((item) => checkedIds.has(item.id)).length;

  const handleToggle = (itemId: string, nextChecked: boolean) => {
    setError(null);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (nextChecked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
    setPendingIds((prev) => new Set(prev).add(itemId));

    void runServerAction(() =>
      toggleGroceryCheck(clientId, planId, itemId, nextChecked, weekKey)
    ).then((result) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });

      if (isActionError(result)) {
        setCheckedIds((prev) => {
          const next = new Set(prev);
          if (nextChecked) next.delete(itemId);
          else next.add(itemId);
          return next;
        });
        setError(result.error);
        return;
      }

      if ("checkedIds" in result) {
        setCheckedIds(new Set(result.checkedIds));
      }
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={platform.common.close}
        className="overlay-backdrop absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grocery-list-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="grocery-list-title" className="text-base font-bold">
              {platform.groceryList.title}
            </h2>
            <p className="text-xs text-muted-foreground">{platform.groceryList.subtitle}</p>
            {items.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {platform.groceryList.progress(boughtCount, items.length)}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{platform.common.loading}</p>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : items.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{platform.groceryList.empty}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {[...grouped.entries()].map(([category, categoryItems]) => (
                <section key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </h3>
                  <ul className="space-y-1">
                    {categoryItems.map((item) => {
                      const checked = checkedIds.has(item.id);
                      const saving = pendingIds.has(item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleToggle(item.id, !checked)}
                            aria-pressed={checked}
                            aria-label={
                              checked
                                ? platform.groceryList.uncheckItem(item.name)
                                : platform.groceryList.checkItem(item.name)
                            }
                            className={cn(
                              "flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                              "hover:bg-secondary/50 active:bg-secondary/70",
                              checked && "opacity-70",
                              saving && "opacity-50"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                                checked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background"
                              )}
                            >
                              {checked ? <Check className="h-3.5 w-3.5" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block text-sm font-medium transition-all",
                                  checked && "line-through text-muted-foreground"
                                )}
                              >
                                {item.name}
                              </span>
                              {item.amount ? (
                                <span className="block text-xs text-muted-foreground">
                                  {item.amount}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
