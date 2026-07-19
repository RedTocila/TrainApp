"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Kept for call-site compatibility. Route enter motion is handled by
 * `.page-enter` in dashboard/admin shells (CSS-only, one animation).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function StaggerContainer({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <>{children}</>;
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.22, ease: EASE },
        },
      }}
      className="will-change-[opacity,transform]"
    >
      {children}
    </motion.div>
  );
}
