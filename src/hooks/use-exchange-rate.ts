"use client";

import { useEffect, useState } from "react";

const FALLBACK_ALL_PER_EUR = 94.36;

export function useExchangeRate(initialRate?: number) {
  const [allPerEur, setAllPerEur] = useState(initialRate ?? FALLBACK_ALL_PER_EUR);

  useEffect(() => {
    if (initialRate != null) {
      setAllPerEur(initialRate);
      return;
    }

    let cancelled = false;

    fetch("/api/exchange-rate")
      .then((response) => response.json())
      .then((data: { allPerEur?: number }) => {
        if (cancelled) return;
        if (typeof data.allPerEur === "number" && data.allPerEur > 0) {
          setAllPerEur(data.allPerEur);
        }
      })
      .catch(() => {
        // keep fallback
      });

    return () => {
      cancelled = true;
    };
  }, [initialRate]);

  return allPerEur;
}
