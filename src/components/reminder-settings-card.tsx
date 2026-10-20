"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useLocale, usePlatformCopy } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateReminderSettings } from "@/lib/actions/reminders";
import { syncReminderDelivery } from "@/lib/reminder-delivery";
import {
  DEFAULT_REMINDER_SETTINGS,
  parseReminderSettings,
  REMINDER_TYPES,
  type ReminderSettings,
  type ReminderType,
} from "@/lib/reminder-settings";
import { cn } from "@/lib/utils";

const TYPE_LABEL_KEY: Record<
  ReminderType,
  "workout" | "meals" | "cardio" | "water" | "habits"
> = {
  workout: "workout",
  meals: "meals",
  cardio: "cardio",
  water: "water",
  habits: "habits",
};

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}

export function ReminderSettingsCard({
  initialSettings,
}: {
  initialSettings?: unknown;
}) {
  const locale = useLocale();
  const platform = usePlatformCopy();
  const [settings, setSettings] = useState(() =>
    parseReminderSettings(initialSettings ?? DEFAULT_REMINDER_SETTINGS)
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [permissionHint, setPermissionHint] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const serverSnapshot = useRef(parseReminderSettings(initialSettings));

  useEffect(() => {
    const next = parseReminderSettings(initialSettings);
    const prev = serverSnapshot.current;
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      serverSnapshot.current = next;
      setSettings(next);
    }
  }, [initialSettings]);

  const isNative = Capacitor.isNativePlatform();

  const persist = (next: ReminderSettings) => {
    setSettings(next);
    setError(null);
    setSuccess(false);
    setPermissionHint(null);

    startTransition(async () => {
      try {
        const result = await updateReminderSettings(next);
        if (result.error) {
          setError(result.error);
          setSettings(serverSnapshot.current);
          return;
        }

        const saved = result.settings ?? next;
        serverSnapshot.current = saved;
        setSettings(saved);
        setSuccess(true);

        if (isNative) {
          try {
            const sync = await syncReminderDelivery(saved, locale);
            if (saved.enabled && !sync.permissionGranted) {
              setPermissionHint(platform.reminders.permissionDenied);
            }
          } catch {
            // offline / plugin errors
          }
        }
      } catch (err) {
        const message =
          err instanceof Error && /failed to fetch/i.test(err.message)
            ? platform.reminders.networkError
            : err instanceof Error
              ? err.message
              : platform.reminders.networkError;
        setError(message);
        setSettings(serverSnapshot.current);
      }
    });
  };

  const setMaster = (enabled: boolean) => {
    persist({ ...settings, enabled });
  };

  const setTypeEnabled = (type: ReminderType, enabled: boolean) => {
    persist({
      ...settings,
      [type]: { ...settings[type], enabled },
    });
  };

  return (
    <Card className="dashboard-flat-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {settings.enabled ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          {platform.reminders.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{platform.reminders.masterLabel}</p>
          <Toggle
            checked={settings.enabled}
            onChange={setMaster}
            disabled={isPending}
            label={platform.reminders.masterLabel}
          />
        </div>

        <div
          className={cn(
            "space-y-3 border-t border-border pt-3",
            !settings.enabled && "pointer-events-none opacity-50"
          )}
        >
          {REMINDER_TYPES.map((type) => (
            <div
              key={type}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5"
            >
              <p className="min-w-0 flex-1 text-sm font-medium">
                {platform.reminders.types[TYPE_LABEL_KEY[type]]}
              </p>
              <Toggle
                checked={settings[type].enabled}
                onChange={(enabled) => setTypeEnabled(type, enabled)}
                disabled={!settings.enabled || isPending}
                label={platform.reminders.types[TYPE_LABEL_KEY[type]]}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {permissionHint && (
          <p className="text-sm text-amber-400">{permissionHint}</p>
        )}
        {success && !error && (
          <p className="text-sm text-green-400">{platform.reminders.saved}</p>
        )}

        {isNative && settings.enabled && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => persist({ ...settings })}
          >
            {platform.reminders.resync}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
