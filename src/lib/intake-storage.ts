"use client";

import type { IntakeResponses } from "@/lib/intake-questionnaire";
import { INTAKE_STORAGE_KEY } from "@/lib/intake-questionnaire";

export function saveIntakeDraft(responses: IntakeResponses) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(responses));
}

export function loadIntakeDraft(): IntakeResponses | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(INTAKE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IntakeResponses;
  } catch {
    return null;
  }
}

export function clearIntakeDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INTAKE_STORAGE_KEY);
}

export function hasIntakeDraft(): boolean {
  return loadIntakeDraft() !== null;
}
