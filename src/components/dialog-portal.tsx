"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Renders overlay UI on document.body so fixed positioning covers the full viewport. */
export function DialogPortal({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;
  return createPortal(children, document.body);
}
