"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AiCoachFab } from "@/components/ai-coach-fab";
import { AiCoachChatDialog } from "@/components/ai-coach-chat-dialog";
import { AiCoachChatAutoOpen } from "@/components/ai-coach-chat-auto-open";
import { AiCoachChatProvider } from "@/components/ai-coach-chat-context";
import { Button } from "@/components/ui/button";

export function AiCoachShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/dashboard/ai" || pathname === "/dashboard/ai/";

  return (
    <AiCoachChatProvider>
      <Suspense fallback={null}>
        <AiCoachChatAutoOpen />
      </Suspense>
      <div className="mx-auto max-w-3xl space-y-5 pb-8 lg:pb-8">
        {!isRoot ? (
          <div className="space-y-3">
            <Link href="/dashboard/ai">
              <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
                <ArrowLeft className="h-4 w-4" />
                AI Coach
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-black">AI Coach</h1>
          </div>
        )}
        {children}
      </div>
      <AiCoachFab />
      <AiCoachChatDialog />
    </AiCoachChatProvider>
  );
}
