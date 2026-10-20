"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { AppDialog } from "@/components/app-dialog";
import { Button } from "@/components/ui/button";
import { useBodyUnits } from "@/components/locale-provider";
import { toggleIntakeMultiSelectValue, type IntakeOption } from "@/lib/intake-questionnaire";
import { cn } from "@/lib/utils";

const HIDE_SCROLL =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

function useSnapIndex(
  axis: "x" | "y",
  index: number,
  itemSize: number,
  count: number,
  onIndex: (index: number) => void
) {
  const ref = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const [pad, setPad] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const viewport = axis === "y" ? el.clientHeight : el.clientWidth;
      const next = Math.max(0, viewport / 2 - itemSize / 2);
      setPad((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [axis, itemSize]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || pad <= 0) return;
    if (pending.current === index) {
      pending.current = null;
      return;
    }
    const next = index * itemSize;
    if (axis === "y") el.scrollTop = next;
    else el.scrollLeft = next;
  }, [axis, index, itemSize, pad]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || count <= 0) return;
    const raw = axis === "y" ? el.scrollTop : el.scrollLeft;
    const next = Math.min(count - 1, Math.max(0, Math.round(raw / itemSize)));
    if (next === index) return;
    pending.current = next;
    onIndex(next);
  };

  return { ref, onScroll, pad };
}

/** Horizontal drag on the readout (outside the ruler itself) moves the ruler. */
function scrubWeightRuler(
  event: ReactPointerEvent<HTMLDivElement>,
  ruler: HTMLDivElement | null,
  drag: { current: { x: number; left: number; pointerId: number; moved: boolean } | null },
  phase: "down" | "move" | "up"
) {
  if (!ruler) return;
  if (phase === "down") {
    if (event.button !== 0 || ruler.contains(event.target as Node)) return;
    drag.current = {
      x: event.clientX,
      left: ruler.scrollLeft,
      pointerId: event.pointerId,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    return;
  }
  const state = drag.current;
  if (!state || state.pointerId !== event.pointerId) return;
  if (phase === "move") {
    const dx = event.clientX - state.x;
    if (Math.abs(dx) > 4) state.moved = true;
    ruler.scrollLeft = state.left - dx;
    return;
  }
  const moved = state.moved;
  drag.current = null;
  if (!moved) return;
  const blockClick = (clickEvent: MouseEvent) => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
  };
  window.addEventListener("click", blockClick, { capture: true, once: true });
}

export function QuestionTitle({
  lead,
  emphasis,
}: {
  lead: string;
  emphasis: string;
}) {
  return (
    <h2 className="text-left">
      <span className="block text-[1.65rem] font-medium leading-[1.15] tracking-tight text-white">
        {lead}
      </span>
      <span className="block text-[2.05rem] font-black leading-[1.05] tracking-tight text-white">
        {emphasis}
      </span>
    </h2>
  );
}

export function FollowUp({
  label,
  first = false,
  children,
}: {
  label: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={first ? undefined : "mt-9"}>
      <p className="mb-3 text-xl font-semibold tracking-tight text-white">{label}</p>
      {children}
    </div>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-center text-sm leading-relaxed text-zinc-500">{children}</p>;
}

export function PillOptions({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: IntakeOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
}) {
  const selected = multi ? (Array.isArray(value) ? value : []) : value;
  const multiValueRef = useRef<string[]>(Array.isArray(value) ? value : []);
  if (multi) multiValueRef.current = Array.isArray(value) ? value : [];

  const toggle = (optionValue: string) => {
    if (!multi) {
      onChange(optionValue);
      return;
    }
    const next = toggleIntakeMultiSelectValue(multiValueRef.current, optionValue);
    multiValueRef.current = next;
    onChange(next);
  };

  const isSelected = (optionValue: string) => {
    if (multi) return Array.isArray(selected) && selected.includes(optionValue);
    return selected === optionValue;
  };

  return (
    <div
      className="flex flex-col gap-3"
      role={multi ? "group" : "radiogroup"}
      aria-label={multi ? "Multiple selections allowed" : undefined}
    >
      {options.map((option) => {
        const active = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={active}
            onClick={() => toggle(option.value)}
            className={cn(
              "flex w-full items-center gap-3 rounded-[1.35rem] border px-5 py-4 text-left transition-colors",
              active
                ? "border-red-500/80 bg-red-600/15 shadow-[0_0_0_1px_rgba(220,38,38,0.35)]"
                : "border-zinc-800 bg-zinc-900/80 active:bg-zinc-900"
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-snug text-white">
                {option.label}
              </span>
              {option.description ? (
                <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
                  {option.description}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center border-2 transition-colors",
                multi ? "rounded-md" : "rounded-full",
                active
                  ? "border-red-500 bg-red-600 text-white"
                  : "border-zinc-600 bg-transparent text-transparent"
              )}
              aria-hidden
            >
              {multi ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : active ? (
                <span className="h-2 w-2 rounded-full bg-white" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AgeWheel({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (age: number) => void;
  compact?: boolean;
}) {
  const min = Math.min(13, value);
  const max = Math.max(80, value);
  const ages: number[] = [];
  for (let age = min; age <= max; age += 1) ages.push(age);
  const index = Math.max(0, ages.indexOf(value));
  const itemSize = compact ? 48 : 64;
  const { ref, onScroll, pad } = useSnapIndex("y", index, itemSize, ages.length, (next) => {
    const age = ages[next];
    if (age != null) onChange(age);
  });

  return (
    <div
      className={cn(
        "relative w-full",
        compact ? "h-64" : "min-h-[18rem] flex-1"
      )}
    >
      <div
        ref={ref}
        onScroll={onScroll}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label="Age in years"
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            event.preventDefault();
            onChange(Math.min(max, value + 1));
          }
          if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            event.preventDefault();
            onChange(Math.max(min, value - 1));
          }
        }}
        className={cn(
          "absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-contain touch-pan-y",
          HIDE_SCROLL
        )}
      >
        <div style={{ height: pad }} />
        {ages.map((age) => {
          const distance = Math.abs(age - value);
          return (
            <div
              key={age}
              className="flex snap-center items-center justify-center"
              style={{ height: itemSize }}
            >
              <span
                className={cn(
                  "leading-none tracking-tight text-white transition-[font-size,opacity,font-weight] duration-150",
                  distance === 0 && "text-[4rem] font-black",
                  distance === 1 && "text-[2.4rem] font-semibold opacity-45",
                  distance === 2 && "text-[1.7rem] font-semibold opacity-25",
                  distance > 2 && "text-xl font-medium opacity-10"
                )}
              >
                {age}
              </span>
            </div>
          );
        })}
        <div style={{ height: pad }} />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-background to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-background to-transparent"
        aria-hidden
      />
      <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 ml-[4.5rem] -translate-y-1/2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Years
      </span>
    </div>
  );
}

export function HeightRuler({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (cm: number) => void;
  compact?: boolean;
}) {
  const cm = Math.round(value);
  const min = Math.min(120, cm);
  const max = Math.max(220, cm);
  const ticks: number[] = [];
  for (let n = max; n >= min; n -= 1) ticks.push(n);
  const index = Math.max(0, ticks.indexOf(cm));
  const itemSize = 10;
  const { ref, onScroll, pad } = useSnapIndex("y", index, itemSize, ticks.length, (next) => {
    const picked = ticks[next];
    if (picked != null) onChange(picked);
  });

  return (
    <div className={cn("flex items-center gap-2", compact ? "h-72" : "h-[26rem]")}>
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center pl-1">
        <div className="flex items-end gap-2">
          <span className="text-7xl font-black leading-none tracking-tight text-white">{cm}</span>
          <span className="mb-2 text-sm font-semibold tracking-[0.16em] text-zinc-400">CM</span>
        </div>
        <div className="mt-5 inline-flex rounded-full bg-zinc-900 p-1">
          <span className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-zinc-950">
            CM
          </span>
        </div>
      </div>
      <div className="relative h-full w-28 shrink-0">
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-0.5 -translate-y-1/2 bg-white"
          aria-hidden
        />
        <div
          ref={ref}
          onScroll={onScroll}
          role="slider"
          tabIndex={0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={cm}
          aria-label="Height in centimeters"
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowRight") {
              event.preventDefault();
              onChange(Math.min(max, cm + 1));
            }
            if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
              event.preventDefault();
              onChange(Math.max(min, cm - 1));
            }
          }}
          className={cn("h-full snap-y snap-mandatory overflow-y-auto overscroll-contain", HIDE_SCROLL)}
        >
          <div style={{ height: pad }} />
          {ticks.map((tick) => {
            const major = tick % 10 === 0;
            const mid = tick % 5 === 0;
            return (
              <div key={tick} className="relative snap-center" style={{ height: itemSize }}>
                {major ? (
                  <span
                    className={cn(
                      "absolute right-12 top-1/2 -translate-y-1/2 text-[11px] tabular-nums",
                      tick === cm ? "font-semibold text-white" : "text-zinc-500"
                    )}
                  >
                    {tick}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "absolute right-0 top-1/2 h-px -translate-y-1/2",
                    tick === cm ? "bg-white" : "bg-zinc-600",
                    major ? "w-9" : mid ? "w-6" : "w-3"
                  )}
                />
              </div>
            );
          })}
          <div style={{ height: pad }} />
        </div>
      </div>
    </div>
  );
}

export function WeightRuler({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (kg: number) => void;
  compact?: boolean;
}) {
  const units = useBodyUnits();
  const min = 35;
  const max = Math.max(220, Math.ceil(value));
  const step = 0.5;
  const ticks: number[] = [];
  for (let half = min * 2; half <= max * 2; half += 1) ticks.push(half / 2);
  const nearest = ticks.reduce((best, tick) =>
    Math.abs(tick - value) < Math.abs(best - value) ? tick : best
  );
  const index = Math.max(0, ticks.indexOf(nearest));
  const itemSize = 14;
  const { ref, onScroll, pad } = useSnapIndex("x", index, itemSize, ticks.length, (next) => {
    const picked = ticks[next];
    if (picked != null) onChange(picked);
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const scrubDrag = useRef<{
    x: number;
    left: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);

  const commitDraft = () => {
    const parsed = units.parseWeightInput(draft);
    setEditing(false);
    if (parsed != null) onChange(parsed);
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center",
        compact ? "pt-2" : "min-h-0 flex-1 pt-4"
      )}
      onPointerDown={(event) => {
        if (editing) return;
        scrubWeightRuler(event, ref.current, scrubDrag, "down");
      }}
      onPointerMove={(event) => {
        if (editing) return;
        scrubWeightRuler(event, ref.current, scrubDrag, "move");
      }}
      onPointerUp={(event) => scrubWeightRuler(event, ref.current, scrubDrag, "up")}
      onPointerCancel={(event) => scrubWeightRuler(event, ref.current, scrubDrag, "up")}
    >
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          aria-label="Weight in kilograms"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitDraft();
          }}
          className="w-40 border-b border-red-500 bg-transparent text-center text-6xl font-black tracking-tight text-white outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(units.formatWeightKgInput(value));
            setEditing(true);
          }}
          className="flex items-end gap-2"
        >
          <span className="text-7xl font-black leading-none tracking-tight text-white">
            {value.toFixed(1)}
          </span>
          <span className="mb-2 text-sm font-semibold tracking-[0.16em] text-zinc-400">KG</span>
        </button>
      )}
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Tap to edit
      </p>
      <div className="relative mt-2 min-h-[9rem] w-full flex-1">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-7 w-px -translate-x-1/2 -translate-y-[1.75rem] bg-white"
          aria-hidden
        />
        <div
          ref={ref}
          onScroll={onScroll}
          role="slider"
          tabIndex={0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label="Weight in kilograms"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              onChange(Math.min(max, Math.round((value + step) * 10) / 10));
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              onChange(Math.max(min, Math.round((value - step) * 10) / 10));
            }
          }}
          className={cn(
            "absolute inset-0 flex snap-x snap-mandatory items-center overflow-x-auto overflow-y-hidden overscroll-contain touch-pan-x",
            HIDE_SCROLL
          )}
        >
          <div className="flex w-max items-start" style={{ paddingLeft: pad, paddingRight: pad }}>
            {ticks.map((tick) => {
              const major = Number.isInteger(tick) && tick % 5 === 0;
              const mid = Number.isInteger(tick);
              const active = tick === nearest;
              return (
                <div
                  key={tick}
                  className="relative h-14 shrink-0 snap-center"
                  style={{ width: itemSize }}
                >
                  <span
                    className={cn(
                      "absolute left-1/2 top-0 w-px -translate-x-1/2",
                      active ? "bg-white" : "bg-zinc-600",
                      major ? "h-7" : mid ? "h-4" : "h-2.5"
                    )}
                  />
                  {major ? (
                    <span className="absolute left-1/2 top-8 -translate-x-1/2 text-[11px] tabular-nums text-zinc-500">
                      {tick.toFixed(0)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-4 inline-flex rounded-full bg-zinc-900 p-1">
        <span className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-zinc-950">KG</span>
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);

function parseClock(value: string, fallback: string): { hour: number; minute: number } {
  const source = /^(\d{1,2}):(\d{2})/.exec(value.trim()) ? value : fallback;
  const match = /^(\d{1,2}):(\d{2})/.exec(source.trim());
  const hour = Math.min(23, Math.max(0, Number(match?.[1] ?? 0)));
  const minute = Math.min(59, Math.max(0, Number(match?.[2] ?? 0)));
  return { hour, minute };
}

function clockLabel(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function TimeColumn({
  label,
  values,
  index,
  onIndex,
}: {
  label: string;
  values: number[];
  index: number;
  onIndex: (index: number) => void;
}) {
  const itemSize = 44;
  const { ref, onScroll, pad } = useSnapIndex("y", index, itemSize, values.length, onIndex);

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <div className="relative h-44">
        <div
          className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-11 -translate-y-1/2 rounded-xl bg-white/10"
          aria-hidden
        />
        <div
          ref={ref}
          onScroll={onScroll}
          className={cn("h-full snap-y snap-mandatory overflow-y-auto overscroll-contain", HIDE_SCROLL)}
        >
          <div style={{ height: pad }} />
          {values.map((value) => {
            const selected = values[index] === value;
            return (
              <div
                key={value}
                className="flex snap-center items-center justify-center"
                style={{ height: itemSize }}
              >
                <span
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    selected ? "font-black text-white" : "text-zinc-500"
                  )}
                >
                  {String(value).padStart(2, "0")}
                </span>
              </div>
            );
          })}
          <div style={{ height: pad }} />
        </div>
      </div>
    </div>
  );
}

export function RecoveryTimeFields({
  wake,
  bedtime,
  onWake,
  onBedtime,
}: {
  wake: string;
  bedtime: string;
  onWake: (value: string) => void;
  onBedtime: (value: string) => void;
}) {
  const [active, setActive] = useState<"wake" | "bed" | null>(null);
  const isWake = active === "wake";
  const current = isWake ? wake : bedtime;
  const fallback = isWake ? "07:00" : "23:00";
  const clock = parseClock(current, fallback);

  const commit = (hour: number, minute: number) => {
    const next = clockLabel(hour, minute);
    if (isWake) onWake(next);
    else onBedtime(next);
  };

  const open = (which: "wake" | "bed") => {
    if (which === "wake" && !wake.trim()) onWake("07:00");
    if (which === "bed" && !bedtime.trim()) onBedtime("23:00");
    setActive(which);
  };

  return (
    <div className="mt-9">
      <div className="grid grid-cols-2 gap-3">
        <TimeChoice
          label="Usual wake time"
          value={wake}
          active={active === "wake"}
          onClick={() => open("wake")}
        />
        <TimeChoice
          label="Usual bedtime"
          value={bedtime}
          active={active === "bed"}
          onClick={() => open("bed")}
        />
      </div>
      <AppDialog
        open={active !== null}
        onClose={() => setActive(null)}
        title={isWake ? "Usual wake time" : "Usual bedtime"}
        footer={
          <Button type="button" className="w-full" onClick={() => setActive(null)}>
            Done
          </Button>
        }
      >
        <div className="flex gap-3 px-5 pb-2">
          <TimeColumn
            label="Hour"
            values={HOURS}
            index={clock.hour}
            onIndex={(index) => commit(HOURS[index] ?? clock.hour, clock.minute)}
          />
          <TimeColumn
            label="Min"
            values={MINUTES}
            index={clock.minute}
            onIndex={(index) => commit(clock.hour, MINUTES[index] ?? clock.minute)}
          />
        </div>
      </AppDialog>
    </div>
  );
}

function TimeChoice({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  const clock = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  const shown = clock ? `${clock[1].padStart(2, "0")}:${clock[2]}` : "Set";

  return (
    <div className="min-w-0">
      <p className="mb-2 text-[13px] font-medium leading-tight text-zinc-400">{label}</p>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-2xl border bg-zinc-900/80 text-base font-semibold tabular-nums",
          active ? "border-red-500/80 text-white" : "border-zinc-800 text-white",
          !clock && "text-zinc-500"
        )}
      >
        {shown}
      </button>
    </div>
  );
}

export function FunnelBackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
    </button>
  );
}

export function FunnelContinue({
  label,
  ready,
  onClick,
}: {
  label: string;
  ready: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" size="xl" className="w-full" disabled={!ready} onClick={onClick}>
      {label}
    </Button>
  );
}

export function FunnelTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const className =
    "w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500/70";
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-400">{label}</span>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(className, "py-3")}
        />
      ) : (
        <input
          id={id}
          type="time"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(className, "h-14 text-base font-semibold [color-scheme:dark]")}
        />
      )}
    </label>
  );
}
