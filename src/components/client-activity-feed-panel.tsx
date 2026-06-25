"use client";

import { useState, useTransition } from "react";
import { getRecentClientActivityPage } from "@/lib/actions/client-activity";
import type { ClientActivityItem } from "@/lib/actions/client-activity";
import { ClientActivityFeed } from "@/components/client-activity-feed";
import { Button } from "@/components/ui/button";

export function ClientActivityFeedPanel({
  initialItems,
  initialCursor,
  initialHasMore,
  showClientName = false,
}: {
  initialItems: ClientActivityItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  showClientName?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    if (!hasMore || isPending) return;
    startTransition(async () => {
      const page = await getRecentClientActivityPage({ cursor: cursor ?? undefined, limit: 20 });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    });
  };

  return (
    <div className="space-y-3">
      <ClientActivityFeed items={items} showClientName={showClientName} />
      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={isPending}>
            {isPending ? "Loading…" : "Load more activity"}
          </Button>
        </div>
      )}
    </div>
  );
}
