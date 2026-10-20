import { Suspense } from "react";
import { OpenAppPageClient } from "@/components/open-app-page-client";

export default function OpenAppPage() {
  return (
    <Suspense
      fallback={<div className="mx-auto mt-24 h-64 max-w-md animate-pulse rounded-2xl bg-muted/40" />}
    >
      <OpenAppPageClient />
    </Suspense>
  );
}
