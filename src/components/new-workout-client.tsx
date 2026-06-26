"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddWorkoutWizard } from "@/components/add-workout-wizard";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/workout-folders";

export function NewWorkoutClient() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    router.push("/dashboard/workout");
  };

  return (
    <AddWorkoutWizard
      open={open}
      folderId={UNCATEGORIZED_FOLDER_ID}
      onClose={handleClose}
      onComplete={() => {
        setOpen(false);
        router.push("/dashboard/workout");
        router.refresh();
      }}
    />
  );
}
