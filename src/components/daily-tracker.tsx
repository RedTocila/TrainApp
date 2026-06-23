"use client";

import { useState, useTransition } from "react";
import { formatDateKey } from "@/lib/utils";
import { addWater, upsertDailyLog } from "@/lib/actions/logs";
import { WaterRing } from "@/components/water-ring";
import { MacroBars } from "@/components/macro-bars";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyTrackerProps {
  clientId: string;
  date: Date;
  log: {
    water_ml: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export function DailyTracker({ clientId, date, log, targets }: DailyTrackerProps) {
  const [isPending, startTransition] = useTransition();
  const dateKey = formatDateKey(date);

  const current = {
    water_ml: log?.water_ml ?? 0,
    calories: log?.calories ?? 0,
    protein: log?.protein ?? 0,
    carbs: log?.carbs ?? 0,
    fat: log?.fat ?? 0,
  };

  const handleAddWater = (amount: number) => {
    startTransition(() => {
      void addWater(clientId, dateKey, amount);
    });
  };

  const handleMacroUpdate = (field: string, value: number) => {
    startTransition(() => {
      void upsertDailyLog(clientId, dateKey, { [field]: value });
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Water Intake</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <WaterRing
            current={current.water_ml}
            onAdd={handleAddWater}
            loading={isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Macros Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <MacroBars current={current} targets={targets} />
          <div className="grid grid-cols-2 gap-3">
            {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label className="capitalize">{field}</Label>
                <Input
                  type="number"
                  defaultValue={current[field]}
                  onBlur={(e) =>
                    handleMacroUpdate(field, parseInt(e.target.value) || 0)
                  }
                />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(() => {
                void upsertDailyLog(clientId, dateKey, current);
              })
            }
          >
            Save Log
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
