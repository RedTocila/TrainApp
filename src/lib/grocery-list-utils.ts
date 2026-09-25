import type { GroceryListItem } from "@/lib/types";
import { formatDateKey } from "@/lib/utils";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseAmountNumber(amount: string): number | null {
  const match = amount.match(/([\d.]+)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function formatAmountValue(value: number, unit: string, weeklyLabel: boolean): string {
  const rounded = value % 1 === 0 ? String(Math.round(value)) : value.toFixed(1);
  if (unit) return `${rounded}${unit}`;
  return weeklyLabel ? `${rounded} (weekly)` : rounded;
}

function formatWeeklyAmount(dailyAmount: string, days = 7): string {
  const value = parseAmountNumber(dailyAmount);
  if (value == null) return dailyAmount ? `${dailyAmount} × ${days} days` : "";

  const weekly = value * days;
  const unit = dailyAmount.replace(/[\d.]+/, "").trim();
  return formatAmountValue(weekly, unit, true);
}

export function groceryItemId(name: string, amount?: string): string {
  return slugify(`${name}-${amount ?? ""}`) || slugify(name) || "item";
}

export function buildWeeklyGroceryListFromMeals(
  meals: Array<{ foods?: { name: string; amount?: string }[] | null }>,
  days = 7
): GroceryListItem[] {
  type Accum = {
    id: string;
    name: string;
    dailySum: number | null;
    unit: string;
    rawDaily: string[];
  };

  const merged = new Map<string, Accum>();

  for (const meal of meals) {
    for (const food of meal.foods ?? []) {
      const name = food.name?.trim();
      if (!name) continue;
      const amount = food.amount?.trim() || "1 serving";
      const id = groceryItemId(name, amount);
      const value = parseAmountNumber(amount);
      const unit = amount.replace(/[\d.]+/, "").trim();
      const existing = merged.get(id);

      if (existing) {
        if (existing.dailySum != null && value != null && existing.unit === unit) {
          existing.dailySum += value;
        } else {
          existing.rawDaily.push(amount);
        }
        continue;
      }

      merged.set(id, {
        id,
        name,
        dailySum: value,
        unit,
        rawDaily: value == null ? [amount] : [],
      });
    }
  }

  return [...merged.values()]
    .map((entry) => {
      const parts: string[] = [];
      if (entry.dailySum != null) {
        parts.push(
          formatAmountValue(entry.dailySum * days, entry.unit, true)
        );
      }
      for (const raw of entry.rawDaily) {
        parts.push(formatWeeklyAmount(raw, days));
      }
      return {
        id: entry.id,
        name: entry.name,
        amount: parts.join(" + "),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeGroceryList(raw: unknown): GroceryListItem[] {
  if (!Array.isArray(raw)) return [];
  const items: GroceryListItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    const amount = typeof row.amount === "string" ? row.amount.trim() : "";
    const category = typeof row.category === "string" ? row.category.trim() : undefined;
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : groceryItemId(name, amount);
    items.push({ id, name, amount, category });
  }

  return items;
}

export function groceryWeekKey(date: Date = new Date()): string {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return formatDateKey(start);
}

export function resolveGroceryWeekKey(weekKey?: string | null): string {
  const trimmed = weekKey?.trim();
  return trimmed ? trimmed : groceryWeekKey();
}

export function groupGroceryByCategory(items: GroceryListItem[]): Map<string, GroceryListItem[]> {
  const groups = new Map<string, GroceryListItem[]>();

  for (const item of items) {
    const key = item.category?.trim() || "Other";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
