"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Send, UserRound } from "lucide-react";
import { sendFitnessChatMessageAction } from "@/lib/actions/ai-chat";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import type { ChatMessage } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STARTER_PROMPTS = [
  "How should I structure my weekly workouts?",
  "What should I eat after training?",
  "How can I hit my protein goal?",
  "Tips for staying consistent?",
];

export function AiChatClient({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    setError(null);
    setInput("");
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);

    startTransition(async () => {
      const result = await sendFitnessChatMessageAction(trimmed, messages);
      if ("error" in result) {
        setError(result.error);
        setMessages((prev) => prev.slice(0, -1));
        setInput(trimmed);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", !embedded && "min-h-[calc(100dvh-14rem)] gap-4")}>
      <Card
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          embedded && "rounded-none border-0 shadow-none"
        )}
      >
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-4 py-4 text-center">
                <AiCoachAvatar size="lg" className="mx-auto h-16 w-16" />
                <div>
                  <p className="font-bold">Ask your AI Coach</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Direct, honest coaching — precise advice, real accountability, no fluff.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      disabled={isPending}
                      className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {message.role === "user" ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <AiCoachAvatar size="xs" className="h-8 w-8 shrink-0" />
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isPending && (
              <div className="flex gap-3">
                <AiCoachAvatar size="xs" className="h-8 w-8 shrink-0" />
                <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-border bg-card p-4"
          >
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about workouts, nutrition, recovery…"
                rows={2}
                disabled={isPending}
                className="min-h-[2.75rem] resize-none"
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl"
                disabled={isPending || !input.trim()}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              General fitness guidance only — not medical advice. Press Enter to send, Shift+Enter for a new line.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
