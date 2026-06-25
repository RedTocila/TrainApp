"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, ExternalLink, Globe, Loader2, UserRound } from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import type { ChatMessage, WebSource } from "@/lib/ai/types";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STARTER_PROMPTS = [
  "How should I structure my weekly workouts?",
  "What should I eat after training?",
  "How can I hit my protein goal?",
  "Tips for staying consistent?",
];

const URL_RE = /https?:\/\/[^\s<>)]+/g;

function renderLinkedText(content: string) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(URL_RE)) {
    const url = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(content.slice(lastIndex, index));
    }
    parts.push(
      <a
        key={`${index}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all underline underline-offset-2"
      >
        {url}
      </a>
    );
    lastIndex = index + url.length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

const ChatSources = memo(function ChatSources({ sources }: { sources: WebSource[] }) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
        aria-expanded={open}
        aria-label={`${sources.length} web sources`}
      >
        <Globe className="h-3.5 w-3.5" />
        {sources.length} source{sources.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 transition-colors hover:border-primary/30 hover:bg-secondary/40"
              >
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {source.title}
                  </span>
                  {source.snippet && (
                    <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                      {source.snippet}
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

const ChatBubble = memo(function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "assistant" && !message.content.trim()) {
    return null;
  }

  return (
    <div
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
        <p className="whitespace-pre-wrap">
          {message.role === "assistant"
            ? renderLinkedText(message.content)
            : message.content}
        </p>
        {message.role === "assistant" && message.sources && message.sources.length > 0 && (
          <ChatSources sources={message.sources} />
        )}
      </div>
    </div>
  );
});

export function AiChatClient({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingWebSearch, setPendingWebSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setInput("");
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const history = messages;
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setPendingWebSearch(false);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not reach AI Coach");
      }

      if (!response.body) {
        throw new Error("No response stream");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          const parsed = JSON.parse(payload) as {
            text?: string;
            error?: string;
            sources?: WebSource[];
            meta?: { searchedWeb?: boolean };
          };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.meta?.searchedWeb !== undefined) {
            setPendingWebSearch(parsed.meta.searchedWeb);
            continue;
          }
          if (parsed.sources?.length) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, sources: parsed.sources };
              }
              return next;
            });
            continue;
          }
          if (!parsed.text) continue;

          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + parsed.text };
            }
            return next;
          });
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "AI request failed";
      setError(msg);
      setMessages((prev) => {
        let next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content) {
          next = next.slice(0, -1);
        }
        if (next[next.length - 1]?.role === "user") {
          next = next.slice(0, -1);
        }
        return next;
      });
      setInput(trimmed);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", !embedded && "min-h-[calc(100dvh-14rem)] gap-4")}>
      {embedded ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-4 [-webkit-overflow-scrolling:touch]"
          >
            {messages.length === 0 && (
              <div className="space-y-4 py-4 text-center">
                <AiCoachAvatar size="lg" className="mx-auto h-16 w-16" />
                <div>
                  <p className="font-bold">Ask your AI Coach</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sarcastic, darkly funny coaching — real advice wrapped in gym-floor roasts.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      disabled={isStreaming}
                      className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <ChatBubble key={`${message.role}-${index}`} message={message} />
            ))}

            {isStreaming &&
              (messages[messages.length - 1]?.role !== "assistant" ||
                !messages[messages.length - 1]?.content?.trim()) && (
              <div className="flex gap-3">
                <AiCoachAvatar size="xs" className="h-8 w-8 shrink-0" />
                <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {pendingWebSearch ? "Searching & thinking…" : "Thinking…"}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-2">
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <div className="relative rounded-2xl border border-border bg-background shadow-sm">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about workouts, nutrition, recovery…"
                rows={1}
                disabled={isStreaming}
                className="min-h-[52px] resize-none border-0 bg-transparent px-4 py-3.5 pr-12 shadow-none focus-visible:ring-0"
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                aria-label="Send message"
                className={cn(
                  "absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  input.trim() && !isStreaming
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                )}
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            </div>
            <p className="mt-2 bg-amber-50 px-2.5 py-1.5 text-[10px] text-muted-foreground dark:bg-amber-500/10">
              I can&apos;t give medical advice. For that consult with a doctor, not me.
            </p>
          </form>
        </div>
      ) : (
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          >
            {messages.length === 0 && (
              <div className="space-y-4 py-4 text-center">
                <AiCoachAvatar size="lg" className="mx-auto h-16 w-16" />
                <div>
                  <p className="font-bold">Ask your AI Coach</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sarcastic, darkly funny coaching — real advice wrapped in gym-floor roasts.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      disabled={isStreaming}
                      className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <ChatBubble key={`${message.role}-${index}`} message={message} />
            ))}

            {isStreaming &&
              (messages[messages.length - 1]?.role !== "assistant" ||
                !messages[messages.length - 1]?.content?.trim()) && (
              <div className="flex gap-3">
                <AiCoachAvatar size="xs" className="h-8 w-8 shrink-0" />
                <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {pendingWebSearch ? "Searching & thinking…" : "Thinking…"}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-border bg-card p-4"
          >
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <div className="relative rounded-2xl border border-border bg-background shadow-sm">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about workouts, nutrition, recovery…"
                rows={1}
                disabled={isStreaming}
                className="min-h-[52px] resize-none border-0 bg-transparent px-4 py-3.5 pr-12 shadow-none focus-visible:ring-0"
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                aria-label="Send message"
                className={cn(
                  "absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  input.trim() && !isStreaming
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                )}
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            </div>
            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[10px] text-muted-foreground dark:bg-amber-500/10">
              I can&apos;t give medical advice. For that consult with a doctor, not me.
            </p>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
