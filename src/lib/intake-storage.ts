"use client";

import type { IntakeResponses } from "@/lib/intake-questionnaire";
import { INTAKE_STORAGE_KEY, normalizeIntakeResponses } from "@/lib/intake-questionnaire";

function readStorage(storage: Storage): string | null {
  return storage.getItem(INTAKE_STORAGE_KEY);
}

export function saveIntakeDraft(responses: IntakeResponses) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(responses));
  sessionStorage.removeItem(INTAKE_STORAGE_KEY);
}

export function loadIntakeDraft(): IntakeResponses | null {
  if (typeof window === "undefined") return null;

  let raw = readStorage(localStorage);
  if (!raw) {
    raw = readStorage(sessionStorage);
    if (raw) {
      localStorage.setItem(INTAKE_STORAGE_KEY, raw);
      sessionStorage.removeItem(INTAKE_STORAGE_KEY);
    }
  }

  if (!raw) return null;
  try {
    return normalizeIntakeResponses(JSON.parse(raw) as IntakeResponses);
  } catch {
    return null;
  }
}

export function clearIntakeDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(INTAKE_STORAGE_KEY);
  sessionStorage.removeItem(INTAKE_STORAGE_KEY);
}

export function hasIntakeDraft(): boolean {
  return loadIntakeDraft() !== null;
}
