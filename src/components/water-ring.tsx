"use client";

import { motion } from "framer-motion";

interface WaterRingProps {
  current: number;
  goal?: number;
  onAdd: (amount: number) => void;
  loading?: boolean;
}

export function WaterRing({ current, goal = 2500, onAdd, loading }: WaterRingProps) {
  const progress = Math.min(current / goal, 1);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - progress * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-36 w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-secondary"
          />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-primary"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{current}</span>
          <span className="text-xs text-muted-foreground">/ {goal} ml</span>
        </div>
      </div>
      <div className="flex gap-2">
        {[250, 500].map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={loading}
            onClick={() => onAdd(amount)}
            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50"
          >
            +{amount}ml
          </button>
        ))}
      </div>
    </div>
  );
}
