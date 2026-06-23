"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteClass } from "@/lib/actions/classes";
import { Button } from "@/components/ui/button";

export function DeleteClassButton({ classId }: { classId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      aria-label="Delete class"
      onClick={() => startTransition(() => { void deleteClass(classId); })}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
