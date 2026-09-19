import { AdminAiChatClient } from "@/components/admin-ai-chat-client";

export default function AdminAiPage() {
  return (
    <div className="-m-4 flex h-[calc(100dvh-var(--dashboard-mobile-header-height)-1px)] min-h-0 flex-col md:-m-6 lg:h-[calc(100dvh-1px)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
        <div>
          <h1 className="text-lg font-black tracking-tight sm:text-xl">
            Admin <span className="text-primary">AI</span>
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Command clients, subscriptions, plans, and mail
          </p>
        </div>
      </header>
      <AdminAiChatClient />
    </div>
  );
}
