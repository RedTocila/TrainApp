"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

/** Matches .chat-command-editable min-height (2rem). */
const SINGLE_LINE_HEIGHT_PX = 32;

interface ChatCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
  onMultilineChange?: (multiline: boolean) => void;
}

export function ChatCommandInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  onMultilineChange,
}: ChatCommandInputProps) {
  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = editableRef.current;
    if (!el || el.innerText === value) return;
    el.innerText = value;
  }, [value]);

  useEffect(() => {
    const el = editableRef.current;
    if (!el || !onMultilineChange) return;

    const syncMultiline = () => {
      const hasExplicitBreak = el.innerText.includes("\n");
      const wrapped = el.scrollHeight > SINGLE_LINE_HEIGHT_PX + 1;
      onMultilineChange(hasExplicitBreak || wrapped);
    };

    syncMultiline();
    const observer = new ResizeObserver(syncMultiline);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onMultilineChange, value]);

  return (
    <div className="chat-command-input-wrap col-start-2 row-start-1 min-w-0 self-end">
      <div
        ref={editableRef}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        contentEditable={disabled ? false : "plaintext-only"}
        suppressContentEditableWarning
        onInput={(e) => {
          const text = e.currentTarget.innerText.replace(/\n$/, "");
          onChange(text);
          if (onMultilineChange) {
            const el = e.currentTarget;
            const hasExplicitBreak = el.innerText.includes("\n");
            const wrapped = el.scrollHeight > SINGLE_LINE_HEIGHT_PX + 1;
            onMultilineChange(hasExplicitBreak || wrapped);
          }
        }}
        onKeyDown={(e) => onKeyDown(e as unknown as KeyboardEvent<HTMLTextAreaElement>)}
        data-placeholder={placeholder}
        className="chat-command-editable"
      />
    </div>
  );
}
