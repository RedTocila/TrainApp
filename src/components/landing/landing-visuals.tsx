"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Animated macro split bars */
export function MacroBars({ className }: { className?: string }) {
  const bars = [
    { label: "P", pct: 32, color: "bg-sky-400" },
    { label: "C", pct: 45, color: "bg-amber-400" },
    { label: "F", pct: 23, color: "bg-rose-400" },
  ];

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Macros today</span>
        <span className="font-semibold text-foreground">2,100 kcal</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
        {bars.map((b) => (
          <motion.div
            key={b.label}
            className={b.color}
            initial={{ width: 0 }}
            animate={{ width: `${b.pct}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-muted-foreground">
        {bars.map((b) => (
          <span key={b.label}>
            {b.label} {b.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mini weight trend line chart */
export function WeightTrendChart({ className }: { className?: string }) {
  const points = "4,28 20,22 36,18 52,14 68,12 84,8";
  const reduce = useReducedMotion();

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Weight trend</span>
        <span className="font-bold text-emerald-400">−3.2 kg</span>
      </div>
      <svg viewBox="0 0 88 32" className="h-16 w-full" aria-hidden>
        <defs>
          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.polyline
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <polygon
          fill="url(#weightFill)"
          points={`${points} 84,32 4,32`}
          opacity={0.6}
        />
      </svg>
      {!reduce && (
        <motion.div
          className="mt-1 h-1 w-8 rounded-full bg-primary/40"
          animate={{ x: [0, 48, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

/** Week calendar strip with completion dots */
export function WeekStrip({ className }: { className?: string }) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const done = [true, true, true, false, false, false, false];

  return (
    <div className={className}>
      <p className="mb-2 text-xs text-muted-foreground">This week</p>
      <div className="flex justify-between gap-1">
        {days.map((d, i) => (
          <div key={`${d}-${i}`} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{d}</span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                done[i]
                  ? "bg-primary text-primary-foreground"
                  : "border border-dashed border-border bg-secondary/50 text-muted-foreground"
              }`}
            >
              {done[i] ? "✓" : "·"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Circular progress ring */
export function ProgressRing({
  value,
  label,
  sublabel,
  className,
}: {
  value: number;
  label: string;
  sublabel: string;
  className?: string;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className={`flex flex-col items-center ${className ?? ""}`}>
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth="8"
        />
        <motion.circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          transform="rotate(-90 44 44)"
        />
        <text
          x="44"
          y="48"
          textAnchor="middle"
          className="fill-foreground text-lg font-black"
          fontSize="18"
        >
          {value}%
        </text>
      </svg>
      <p className="mt-1 text-sm font-bold">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}

/** Funnel connector arrows between steps */
export function FunnelConnector() {
  return (
    <div className="hidden items-center px-2 md:flex" aria-hidden>
      <svg width="40" height="12" viewBox="0 0 40 12" className="text-primary/50">
        <path
          d="M0 6h32M28 2l8 4-8 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
