export function MacroSummary({
  calories,
  protein,
  carbs,
  fat,
  compact = false,
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  compact?: boolean;
}) {
  const items = [
    { label: "Cal", value: calories, color: "bg-orange-500", max: 3000 },
    { label: "P", value: protein, color: "bg-blue-500", max: 250 },
    { label: "C", value: carbs, color: "bg-amber-500", max: 400 },
    { label: "F", value: fat, color: "bg-rose-500", max: 120 },
  ];

  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg bg-secondary/50 px-2 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
            <p className="text-sm font-bold">{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => {
        const pct = Math.min(100, Math.round((item.value / item.max) * 100));
        return (
          <div key={item.label} className="rounded-xl bg-secondary/30 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-muted-foreground">{item.label}</span>
              <span className="font-bold">{item.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
