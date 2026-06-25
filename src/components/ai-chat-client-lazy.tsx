"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

export const AiChatClientLazy = dynamic(
  () => import("@/components/ai-chat-client").then((mod) => ({ default: mod.AiChatClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading chat…
      </div>
    ),
  }
);
