"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/lib/ai/types";
import { ChatCommandInput } from "@/components/chat-command-input";
import { cn } from "@/lib/utils";

const STARTER_PROMPTS = [
  "Who's on free trial?",
  "Show revenue last 30 days",
  "Find client by email…",
  "Grant Elite monthly to someone",
];

function createSmoothReveal(onUpdate: (text: string) => void) {
  let received = "";
  let shown = "";
  let raf: number | null = null;

  const tick = () => {
    if (shown.length >= received.length) {
      raf = null;
      return;
    }
    const lag = received.length - shown.length;
    const step = lag > 48 ? Math.ceil(lag / 6) : lag > 16 ? 4 : lag > 4 ? 2 : 1;
    shown = received.slice(0, shown.length + step);
    onUpdate(shown);
    raf = requestAnimationFrame(tick);
  };

  const schedule = () => {
    if (raf == null) raf = requestAnimationFrame(tick);
  };

  return {
    push(chunk: string) {
      received += chunk;
      schedule();
    },
    flush() {
      shown = received;
      if (raf != null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      onUpdate(shown);
    },
    stop() {
      if (raf != null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    },
  };
}

function stripMarkdownAsterisks(content: string) {
  return content.replace(/\*\*/g, "");
}

const URL_RE = /https?:\/\/[^\s<>)]+/g;

function renderLinkedText(content: string) {
  const text = stripMarkdownAsterisks(content);
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
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

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

const ChatBubble = memo(function ChatBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {message.role === "assistant" ? (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
      ) : null}
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
          {isStreaming && message.role === "assistant" && message.content.trim() ? (
            <span
              className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.1em] animate-pulse rounded-sm bg-primary align-text-bottom"
              aria-hidden
            />
          ) : null}
        </p>
        {message.role === "assistant" && message.toolStatus ? (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              message.content.trim() ? "mt-2" : ""
            )}
          >
            {message.toolStatus}
          </p>
        ) : null}
      </div>
    </div>
  );
});

export function AdminAiChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  isStreamingRef.current = isStreaming;
  const [isMultiline, setIsMultiline] = useState(false);

  const handleMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= 96;
  };

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreamingRef.current) return;

    setError(null);
    setInput("");
    stickToBottomRef.current = true;
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const history = messages;
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/admin/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Chat unreachable");
      }

      if (!response.body) throw new Error("No stream");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const setAssistantContent = (content: string) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content,
              toolStatus: undefined,
            };
          }
          return next;
        });
      };

      const reveal = createSmoothReveal((t) => setAssistantContent(t));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
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
              toolStatus?: string | null;
            };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.toolStatus !== undefined) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    toolStatus: parsed.toolStatus || undefined,
                  };
                }
                return next;
              });
              continue;
            }
            if (!parsed.text) continue;
            reveal.push(parsed.text);
          }
        }
        reveal.flush();
      } finally {
        reveal.stop();
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "user" && last.content === trimmed) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        return;
      }
      const msg = err instanceof Error ? err.message : "Request failed";
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

  const canSend = Boolean(input.trim() && !isStreaming);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div
        ref={scrollRef}
        onScroll={handleMessagesScroll}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-4 [-webkit-overflow-scrolling:touch]"
      >
        {messages.length === 0 ? (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-bold">Admin Command</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage clients, subscriptions, workouts, diets, and mail with natural language.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={isStreaming}
                  className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <ChatBubble
            key={`${message.role}-${index}`}
            message={message}
            isStreaming={
              isStreaming &&
              index === messages.length - 1 &&
              message.role === "assistant"
            }
          />
        ))}

        {isStreaming &&
        (messages[messages.length - 1]?.role !== "assistant" ||
          !messages[messages.length - 1]?.content?.trim()) ? (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Working…
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-w-0 shrink-0 border-t border-border/60 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3">
        {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
        <form onSubmit={handleSubmit} className="min-w-0 w-full">
          <div
            className={cn(
              "chat-command-shell flex w-full max-w-full min-w-0 items-end gap-1 overflow-hidden border border-border/70 bg-secondary/60 p-1 pl-3 shadow-sm backdrop-blur-sm transition-[border-radius] duration-200",
              isMultiline ? "rounded-2xl" : "rounded-full"
            )}
          >
            <ChatCommandInput
              value={input}
              onChange={setInput}
              onKeyDown={handleKeyDown}
              placeholder="Command the platform…"
              disabled={isStreaming}
              onMultilineChange={setIsMultiline}
              className="chat-command-input-wrap min-w-0 flex-1 self-end"
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className={cn(
                "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_14px_rgba(var(--primary-rgb),0.4)] transition-opacity",
                canSend ? "hover:opacity-90" : "cursor-not-allowed opacity-45"
              )}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
