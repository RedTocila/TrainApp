"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const HeaderCalendarNodeContext = createContext<HTMLElement | null>(null);
const HeaderCalendarSetterContext = createContext<
  (node: HTMLElement | null) => void
>(() => {});

export function HeaderCalendarProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null);

  return (
    <HeaderCalendarSetterContext.Provider value={setNode}>
      <HeaderCalendarNodeContext.Provider value={node}>
        {children}
      </HeaderCalendarNodeContext.Provider>
    </HeaderCalendarSetterContext.Provider>
  );
}

/** Mount point inside the sticky dashboard header. */
export function HeaderCalendarSlot() {
  const setNode = useContext(HeaderCalendarSetterContext);
  return <div ref={setNode} />;
}

export function HeaderCalendarPortal({ children }: { children: ReactNode }) {
  const node = useContext(HeaderCalendarNodeContext);
  if (!node) return null;
  return createPortal(children, node);
}
