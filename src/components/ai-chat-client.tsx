"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, ExternalLink, Globe, Loader2, Paperclip, UserRound, X } from "lucide-react";
import { AiCoachAvatar } from "@/components/ai-coach-avatar";
import { useAiCoachChat } from "@/components/ai-coach-chat-context";
import { usePlatformCopy } from "@/components/locale-provider";
import type { ChatMessage, WebSource } from "@/lib/ai/types";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { compressImageFile, fileToDataUrl } from "@/lib/image-compress";
import { cn } from "@/lib/utils";

const URL_RE = /https?:\/\/[^\s<>)]+/g;

function stripMarkdownAsterisks(content: string) {
  return content.replace(/\*\*/g, "");
}

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

const ChatSources = memo(function ChatSources({
  sources,
  sourcesLabel,
  webSourcesAria,
}: {
  sources: WebSource[];
  sourcesLabel: (n: number) => string;
  webSourcesAria: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
        aria-expanded={open}
        aria-label={webSourcesAria(sources.length)}
      >
        <Globe className="h-3.5 w-3.5" />
        {sourcesLabel(sources.length)}
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

const ChatBubble = memo(function ChatBubble({
  message,
  sourcesLabel,
  webSourcesAria,
}: {
  message: ChatMessage;
  sourcesLabel: (n: number) => string;
  webSourcesAria: (n: number) => string;
}) {
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
          <ChatSources
            sources={message.sources}
            sourcesLabel={sourcesLabel}
            webSourcesAria={webSourcesAria}
          />
        )}
      </div>
    </div>
  );
});

function ChatCommandBar({
  input,
  onInputChange,
  onKeyDown,
  onSubmit,
  placeholder,
  disabled,
  canSend,
  isStreaming,
  sendAriaLabel,
  attachAriaLabel,
  removeAttachmentAriaLabel,
  attachmentPreviewUrl,
  onAttachSelect,
  onAttachmentClear,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  disabled: boolean;
  canSend: boolean;
  isStreaming: boolean;
  sendAriaLabel: string;
  attachAriaLabel: string;
  removeAttachmentAriaLabel: string;
  attachmentPreviewUrl: string | null;
  onAttachSelect: (file: File) => void;
  onAttachmentClear: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {attachmentPreviewUrl && (
        <div className="flex items-center gap-2 px-1">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-secondary/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachmentPreviewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={onAttachmentClear}
              disabled={disabled}
              aria-label={removeAttachmentAriaLabel}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-end gap-1 rounded-full border border-border/70 bg-secondary/60 p-1.5 pl-2 shadow-sm backdrop-blur-sm">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttachSelect(file);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label={attachAriaLabel}
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Paperclip className="h-4 w-4" strokeWidth={2} />
        </button>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-0 py-2.5 shadow-none focus-visible:ring-0"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={sendAriaLabel}
          className={cn(
            "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_14px_rgba(var(--primary-rgb),0.4)] transition-opacity",
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
  );
}

export function AiChatClient({ embedded = false }: { embedded?: boolean }) {
  const platform = usePlatformCopy();
  const ai = platform.ai;
  const { openReadMe, canChat } = useAiCoachChat();
  const starterPrompts = [...ai.starterPrompts];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingWebSearch, setPendingWebSearch] = useState(false);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleAttachSelect = async (file: File) => {
    try {
      const compressed = await compressImageFile(file);
      setAttachmentPreviewUrl(await fileToDataUrl(compressed));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : platform.photos.uploadFailed);
    }
  };

  const handleAttachmentClear = () => {
    setAttachmentPreviewUrl(null);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || !canChat) return;

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
        throw new Error(payload?.error ?? ai.chatUnreachable);
      }

      if (!response.body) {
        throw new Error(ai.noStream);
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
      const msg = err instanceof Error ? err.message : ai.requestFailed;
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

  const canSend = Boolean(input.trim() && !isStreaming && canChat);

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
                  <p className="font-bold">{ai.askAlex}</p>
                  <button
                    type="button"
                    onClick={openReadMe}
                    className="mt-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                  >
                    {ai.readMeButton}
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      disabled={isStreaming || !canChat}
                      className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <ChatBubble
                key={`${message.role}-${index}`}
                message={message}
                sourcesLabel={ai.sources}
                webSourcesAria={platform.aria.webSources}
              />
            ))}

            {isStreaming &&
              (messages[messages.length - 1]?.role !== "assistant" ||
                !messages[messages.length - 1]?.content?.trim()) && (
              <div className="flex gap-3">
                <AiCoachAvatar size="xs" className="h-8 w-8 shrink-0" />
                <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {pendingWebSearch ? ai.searching : ai.thinking}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 bg-background px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2">
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <ChatCommandBar
              input={input}
              onInputChange={setInput}
              onKeyDown={handleKeyDown}
              onSubmit={handleSubmit}
              placeholder={canChat ? ai.placeholder : ai.readMeRequiredPlaceholder}
              disabled={isStreaming || !canChat}
              canSend={canSend}
              isStreaming={isStreaming}
              sendAriaLabel={platform.aria.sendMessage}
              attachAriaLabel={platform.aria.attachFile}
              removeAttachmentAriaLabel={platform.aria.removeAttachment}
              attachmentPreviewUrl={attachmentPreviewUrl}
              onAttachSelect={(file) => void handleAttachSelect(file)}
              onAttachmentClear={handleAttachmentClear}
            />
          </div>
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
                  <p className="font-bold">{ai.askAlex}</p>
                  <button
                    type="button"
                    onClick={openReadMe}
                    className="mt-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                  >
                    {ai.readMeButton}
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      disabled={isStreaming || !canChat}
                      className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <ChatBubble
                key={`${message.role}-${index}`}
                message={message}
                sourcesLabel={ai.sources}
                webSourcesAria={platform.aria.webSources}
              />
            ))}

            {isStreaming &&
              (messages[messages.length - 1]?.role !== "assistant" ||
                !messages[messages.length - 1]?.content?.trim()) && (
              <div className="flex gap-3">
                <AiCoachAvatar size="xs" className="h-8 w-8 shrink-0" />
                <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {pendingWebSearch ? ai.searching : ai.thinking}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/50 bg-card p-4">
            {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
            <ChatCommandBar
              input={input}
              onInputChange={setInput}
              onKeyDown={handleKeyDown}
              onSubmit={handleSubmit}
              placeholder={canChat ? ai.placeholder : ai.readMeRequiredPlaceholder}
              disabled={isStreaming || !canChat}
              canSend={canSend}
              isStreaming={isStreaming}
              sendAriaLabel={platform.aria.sendMessage}
              attachAriaLabel={platform.aria.attachFile}
              removeAttachmentAriaLabel={platform.aria.removeAttachment}
              attachmentPreviewUrl={attachmentPreviewUrl}
              onAttachSelect={(file) => void handleAttachSelect(file)}
              onAttachmentClear={handleAttachmentClear}
            />
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
